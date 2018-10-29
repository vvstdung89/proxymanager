FROM node:latest
WORKDIR /usr/src/app
COPY package.json /usr/src/app
RUN npm install
RUN npm install -g nodemon
COPY . /usr/src/app
CMD nodemon server.js