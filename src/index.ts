import express = require('express');
import { Application } from 'express';

import socketIo = require('socket.io');

import { createServer, Server } from 'http';

let app: Application = express();

var clients = {};
var units;

resetUnits();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html');
})

app.get('/fillin-map.png', (req, res) => {
  res.sendFile(__dirname + '/client/fillin-map-v2.png');
});

let http = createServer(app);

let io = socketIo(http);

io.on('connection', (socket) => {
  console.log('a user connected');
  clients[socket.id] = {};

  socket.on('name message', (msg) => {
    console.log('Client Provided Name: ' + msg);
    clients[socket.id].name = msg;
    socket.emit('signed-in', clients[socket.id].name);
    socket.emit('units', units)
    socket.broadcast.emit('joined', clients[socket.id].name);
  });

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
    io.sockets.emit('message', clients[socket.id].name + " has reset all units.");
    io.sockets.emit('units', units);
  })

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
})

http.listen(4199, () => {
  console.log('listening on *:4199');
})

function resetUnits() {
  units = [{"id":"E1","top":1022.0039,"left":665.0039,"color":"black"},{"id":"E2","top":680.0039,"left":549.0039,"color":"black"},{"id":"E3","top":768.0039,"left":221.0039,"color":"black"},{"id":"E5","top":855.0039,"left":339.0039,"color":"black"},{"id":"E7","top":1146.0039,"left":351.0039,"color":"black"},{"id":"E8","top":1263.0039,"left":708.0039,"color":"black"},{"id":"E9","top":770.0039,"left":828.0039,"color":"black"},{"id":"E10","top":576.0039,"left":341.0039,"color":"black"},{"id":"E12","top":920.0039,"left":965.0039,"color":"black"},{"id":"E13","top":1010.0039,"left":431.0039,"color":"black"},{"id":"E16","top":738.0039,"left":663.0039,"color":"black"},{"id":"E17","top":863,"left":613,"color":"black"},{"id":"E19","top":197.0039,"left":503.0039,"color":"black"},{"id":"T2","top":639.0039,"left":342.0039,"color":"red"},{"id":"T3","top":1206,"left":512,"color":"red"},{"id":"T4","top":1037.0039,"left":887.0039,"color":"red"},{"id":"T5","top":1003,"left":241,"color":"red"},{"id":"T6","top":791,"left":671,"color":"red"},{"id":"T10","top":945,"left":429,"color":"red"},{"id":"R11","top":927,"left":647,"color":"blue"}];
}