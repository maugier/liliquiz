FROM node:23-slim
WORKDIR /home/node
COPY *.json /home/node
RUN npm install
COPY *.js *.html /home/node
USER node
EXPOSE 3000
CMD node index.js
