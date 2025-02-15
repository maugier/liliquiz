// Liliquiz v0.1 (c) Maxime Augier <max@xolus.net>

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import session from 'express-session';
import formidable from 'express-formidable';

const app = express();
const server = createServer(app);
const io = new Server(server);

const rootdir = dirname(fileURLToPath(import.meta.url));
function page(name) { return join(rootdir, name) };

let admin_password = process.env.PASSWORD;
if (!admin_password) {
    console.log("Please define the PASSWORD env variable.");
    process.exit(1);
}

let question = "Rien pour l'instant !";
let choices = [];
let results = [];
const voted = new Set();

function admin_only(req,res,next) {
    if (!req.session.admin) {
        return res.sendStatus(403)
    } else {
        return next()
    }
}

function set_choices(new_choices, new_question) {
    choices = new_choices;
    question = new_question;
    results = new_choices.map(() => 0);
    voted.clear();

    io.emit('choices', choices, question);
}

app.use(session({
    resave: false,
    saveUninitialized: false, 
    secret: randomUUID(),
}))
app.use(formidable());

app.get('/', (req, res) => {
    res.sendFile(page("index.html"));
});

app.get('/login', (req,res) => {
    res.sendFile(page("login.html"));
})

app.post('/login', (req, res) => {
    if (req.fields.password !== admin_password) {
        return res.sendStatus(403);
    }
    req.session.admin = true;
    res.redirect('/choices');
})

app.use('/choices', admin_only);
app.get('/choices', (req, res) => {
    res.sendFile(page("choices.html"));
})

app.post('/choices', (req, res) => {
    console.log(JSON.stringify(req.fields));
    set_choices(req.fields.choice, req.fields.question);
    res.redirect("/#abstain")
});

io.on('connection', (socket) => {
    console.log('user connected');

    socket.on('disconnect', (reason, desc) => {
        console.log('user disconnected')
    })

    socket.on('vote', (idx) => {

        if (!(typeof idx === 'number') || idx < 0 || idx > choices.length) {
            console.log(`invalid vote ${idx}`);
            return;
        }

        if (voted.has(socket)) {
            console.log(`double vote`);
            return;
        }

        console.log(`user voted ${idx}`)
        voted.add(socket);
        if (idx > 0) {
            results[idx-1] += 1;
        }
        console.log(`results: ${results}`);

        for (const socket of voted) {
            socket.emit('results', results);
        }

    })

    socket.emit('choices', choices, question);
})

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
})
