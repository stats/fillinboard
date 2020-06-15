import express = require('express');
import { Application, Router } from 'express';

import { BASIC_USERS, ADMIN_USERS } from '../users';

import socketIo = require('socket.io');

import { createServer, Server } from 'http';

var moment = require('moment');

let app: Application = express();

const basicAuth = require('express-basic-auth');

var clients = {};
var units;
var title = { user: 'system', text: 'Title Not Set', date: moment().format('MM/DD/YY HH:mm:ss') }
var messages = [];

resetUnits();

app.get('/', (req, res) => {
  res.send('<h1>Fillin Board</h1>');
});

app.get('/tool.png', (req, res) => {
  res.sendFile(__dirname + '/client/tool.png');
});

app.get('/style.css', (req, res) => {
  res.sendFile(__dirname + '/client/style.css');
});

app.get('/fillin-map.png', (req, res) => {
  res.sendFile(__dirname + '/client/fillin-map-v4.png');
});

app.get('/DragDropTouch.js', (req, res) => {
  res.sendFile(__dirname + '/client/DragDropTouch.js');
});

/**
 * Basic Router with User Security
 **/
const router = Router();

router.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/view', basicAuth({
  challenge: true,
  users: BASIC_USERS
}), router);

/**
 * Admin Router with Admin Security
 **/
const admin = Router();
admin.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/edit.html');
});
app.use('/admin', basicAuth({
  challenge: true,
  users: ADMIN_USERS
}), admin);

let http = createServer(app);

let io = socketIo(http);

io.on('connection', (socket) => {
  console.log('a user connected');

  clients[socket.id] = {};

  socket.emit('units', units);
  socket.emit('set-title', title);

  socket.on('chat', (msg) => {
    let message = {
      user: clients[socket.id].name,
      text: msg,
      date: moment().format('MM/DD/YY HH:mm:ss')
    }
    messages.push(message);
    if(messages.length > 50) {
      messages.shift();
    }
    io.sockets.emit('chat', message);
  });

  socket.on('submit-name', (msg) => {
    console.log('Client Submitted Name: ' + msg);
    clients[socket.id].name = msg;
    socket.emit('signed-in', clients[socket.id].name);
    socket.emit('units', units);
    socket.emit('set-title', title);
    socket.emit('recent-chat', messages);
    io.sockets.emit('users', clientsToStringArray(clients));
    socket.broadcast.emit('joined', clients[socket.id].name);
  });

  socket.on('set-title', (msg) => {
    title = {
      user: clients[socket.id].name,
      text: msg,
      date: moment().format('MM/DD/YY HH:mm:ss')
    }
    io.sockets.emit('set-title', title);
  })

  socket.on('change-unit', (msg) => {
    console.log('Client changed a unit', msg);
    let unit = units.find(unit => unit.id === msg.id);
    if(unit) {
      unit.left = msg.left;
      unit.top = msg.top;
    }
    io.sockets.emit('units', units);
    //console.log(JSON.stringify(units));
  });

  socket.on('add-unit', (msg) => {
    console.log('Add unit', msg);
    let unit = units.find(u => u.id === msg.id);
    if(unit != null) return;
    if(msg == null || msg.id == null || msg.id == '') {
      socket.emit('add-error', 'Cannot add a blank unit');
      return;
    }
    units.push(msg);
    io.sockets.emit('units', units);
  });

  socket.on('remove-unit', (msg) => {
    console.log('Remove unit', msg, msg.id);
    units = units.filter(unit => unit.id != msg.id);
    io.sockets.emit('units', units);
  });

  socket.on('reset-units', (msg) => {
    console.log("Reset Units called.");
    resetUnits();
    title = { user: 'system', text: 'Title Not Set', date: moment().format('MM/DD/YY HH:mm:ss') };
    io.sockets.emit('message', clients[socket.id].name + " has reset all units.");
    io.sockets.emit('units', units);
    io.sockets.emit('set-title', title);
  });

  socket.on('toggle-on-call', (msg) => {
    let unit = units.find(unit => unit.id === msg.id);
    if(!unit) return;
    if(unit.onCall == null || unit.onCall == false) {
      unit.onCall = true;
    } else {
      unit.onCall = false;
    }
    io.sockets.emit('units', units);
  });

  socket.on('disconnect', () => {
    delete clients[socket.id];
    io.sockets.emit('users', clientsToStringArray(clients));
    console.log('user disconnected');
  });
})

http.listen(4198, () => {
  console.log('listening on *:4198');
})

function clientsToStringArray(clients) {
  let a = [];
  for(let client in clients) {
    let c = clients[client];
    if(c.name != null) {
      a.push(c.name);
    }
  }
  return a;
}

function resetUnits() {
  units = [
    {"id":"E1","top":475,"left":329,"color":"black","hasTool":true},
    {"id":"E2","top":318,"left":274,"color":"black"},
    {"id":"E3","top":361,"left":125,"color":"black"},
    {"id":"E5","top":400,"left":180,"color":"black"},
    {"id":"E7","top":536,"left":185,"color":"black"},
    {"id":"E8","top":597,"left":361,"color":"black"},
    {"id":"E9","top":366,"left":406,"color":"black"},
    {"id":"E10","top":272,"left":180,"color":"black","hasTool":true},
    {"id":"E12","top":424,"left":464,"color":"black"},
    {"id":"E13","top":443,"left":217,"color":"black"},
    {"id":"E16","top":340,"left":323,"color":"black"},
    {"id":"E17","top":402,"left":315,"color":"black"},
    {"id":"E19","top":95,"left":254,"color":"black"},
    {"id":"T2","top":299,"left":179,"color":"red"},
    {"id":"T3","top":562,"left":258,"color":"red"},
    {"id":"T4","top":479,"left":427,"color":"red"},
    {"id":"T5","top":464,"left":132,"color":"red"},
    {"id":"T6","top":369,"left":322,"color":"red"},
    {"id":"T10","top":470,"left":216,"color":"red"},
    {"id":"R11","top":429,"left":313,"color":"blue","hasTool":true}
  ];
}
