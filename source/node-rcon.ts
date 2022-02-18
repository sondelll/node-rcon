/*!
 * Node-rcon
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 * 
 * Remixed by Lukas Sondell, 2022
 */

import events from 'events';
import net from 'net';
import { Buffer } from 'buffer';
import EventEmitter from 'events';

var PacketType = {
  COMMAND: 0x02,
  AUTH: 0x03,
  RESPONSE_VALUE: 0x00,
  RESPONSE_AUTH: 0x02
};


export class Rcon extends EventEmitter {
   host:string;
   port:number;
   password:string;
   rconId:number;
   hasAuthed:boolean;
   outstandingData:any;
   _tcpSocket?:net.Socket;

   constructor(host:string, port:number, password:string,id?:number) {
      super();
      
      this.host = host;
      this.port = port;
      this.password = password;
      this.rconId = id || 0x0012D4A6; // This is arbitrary in most cases
      this.hasAuthed = false;
      this.outstandingData = null;
      
      events.EventEmitter.call(this);
      if (!(this instanceof Rcon)) return new Rcon(host, port, password);
   };

   send(data:any, cmd:number, id?:number) {
      var sendBuf:Buffer;

      cmd = cmd || PacketType.COMMAND;
      id = id || this.rconId;
   
      var length = Buffer.byteLength(data);
      sendBuf = Buffer.alloc(length + 14);
      sendBuf.writeInt32LE(length + 10, 0);
      sendBuf.writeInt32LE(id, 4);
      sendBuf.writeInt32LE(cmd, 8);
      sendBuf.write(data, 12);
      sendBuf.writeInt16LE(0, length + 12);
     
      this._sendSocket(sendBuf);
    };

    _sendSocket(buf:Buffer) {
        this._tcpSocket?.write(buf.toString('binary'), 'binary');
    };

    connect() {
      var self = this;
    
        this._tcpSocket = net.createConnection(this.port, this.host);
        this._tcpSocket.on('data', function(data) { self._tcpSocketOnData(data) })
                       .on('connect', function() { self.socketOnConnect() })
                       .on('error', function(err) { self.emit('error', err) })
                       .on('end', function() { self.socketOnEnd() });
    };

    disconnect() {
      if (this._tcpSocket) this._tcpSocket.end();
    };

    setTimeout(timeout:number, callback:Function) {
      if (!this._tcpSocket) return;
    
      var self = this;
      this._tcpSocket.setTimeout(timeout, function() {
        self._tcpSocket?.end();
        if (callback) callback();
      });
    };

    _tcpSocketOnData(data:any) {
      if (this.outstandingData != null) {
        data = Buffer.concat([this.outstandingData, data], this.outstandingData.length + data.length);
        this.outstandingData = null;
      }
    
      while (data.length >= 12) {
        var len = data.readInt32LE(0); // Size of entire packet, not including the 4 byte length field
        if (!len) return; // No valid packet header, discard entire buffer
    
        var packetLen = len + 4;
        if (data.length < packetLen) break; // Wait for full packet, TCP may have segmented it
    
        var bodyLen = len - 10; // Subtract size of ID, type, and two mandatory trailing null bytes
        if (bodyLen < 0) {
          data = data.slice(packetLen); // Length is too short, discard malformed packet
          break;
        }
    
        var id = data.readInt32LE(4);
        var type = data.readInt32LE(8);
    
        if (id == this.rconId) {
          if (!this.hasAuthed && type == PacketType.RESPONSE_AUTH) {
            this.hasAuthed = true;
            this.emit('auth');
          } else if (type == PacketType.RESPONSE_VALUE) {
            // Read just the body of the packet (truncate the last null byte)
            // See https://developer.valvesoftware.com/wiki/Source_RCON_Protocol for details
            var str = data.toString('utf8', 12, 12 + bodyLen);
    
            if (str.charAt(str.length - 1) === '\n') {
              // Emit the response without the newline.
              str = str.substring(0, str.length - 1);
            }
    
            this.emit('response', str);
          }
        } else if (id == -1) {
          this.emit('error', new Error("Authentication failed"));
        } else {
          // ping/pong likely
          var str = data.toString('utf8', 12, 12 + bodyLen);
    
          if (str.charAt(str.length - 1) === '\n') {
            // Emit the response without the newline.
            str = str.substring(0, str.length - 1);
          }
    
          this.emit('server', str);
        }
    
        data = data.slice(packetLen);
      }
    
      // Keep a reference to remaining data, since the buffer might be split within a packet
      this.outstandingData = data;
    };

    socketOnConnect() {
      this.emit('connect');
    
      this.send(this.password, PacketType.AUTH);
      
    };
    
    socketOnEnd() {
      this.emit('end');
      this.hasAuthed = false;
    };
    
}
   
   module.exports = Rcon;
