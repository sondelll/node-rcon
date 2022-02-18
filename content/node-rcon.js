"use strict";
/*!
 * Node-rcon
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 *
 * Remixed by Lukas Sondell, 2022
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rcon = void 0;
var events_1 = __importDefault(require("events"));
var net_1 = __importDefault(require("net"));
var buffer_1 = require("buffer");
var events_2 = __importDefault(require("events"));
var PacketType = {
    COMMAND: 0x02,
    AUTH: 0x03,
    RESPONSE_VALUE: 0x00,
    RESPONSE_AUTH: 0x02
};
var Rcon = (function (_super) {
    __extends(Rcon, _super);
    function Rcon(host, port, password, id) {
        var _this = _super.call(this) || this;
        _this.host = host;
        _this.port = port;
        _this.password = password;
        _this.rconId = id || 0x0012D4A6;
        _this.hasAuthed = false;
        _this.outstandingData = null;
        events_1.default.EventEmitter.call(_this);
        if (!(_this instanceof Rcon))
            return new Rcon(host, port, password);
        return _this;
    }
    ;
    Rcon.prototype.send = function (data, cmd, id) {
        var sendBuf;
        cmd = cmd || PacketType.COMMAND;
        id = id || this.rconId;
        var length = buffer_1.Buffer.byteLength(data);
        sendBuf = buffer_1.Buffer.alloc(length + 14);
        sendBuf.writeInt32LE(length + 10, 0);
        sendBuf.writeInt32LE(id, 4);
        sendBuf.writeInt32LE(cmd, 8);
        sendBuf.write(data, 12);
        sendBuf.writeInt16LE(0, length + 12);
        this._sendSocket(sendBuf);
    };
    ;
    Rcon.prototype._sendSocket = function (buf) {
        var _a;
        (_a = this._tcpSocket) === null || _a === void 0 ? void 0 : _a.write(buf.toString('binary'), 'binary');
    };
    ;
    Rcon.prototype.connect = function () {
        var self = this;
        this._tcpSocket = net_1.default.createConnection(this.port, this.host);
        this._tcpSocket.on('data', function (data) { self._tcpSocketOnData(data); })
            .on('connect', function () { self.socketOnConnect(); })
            .on('error', function (err) { self.emit('error', err); })
            .on('end', function () { self.socketOnEnd(); });
    };
    ;
    Rcon.prototype.disconnect = function () {
        if (this._tcpSocket)
            this._tcpSocket.end();
    };
    ;
    Rcon.prototype.setTimeout = function (timeout, callback) {
        if (!this._tcpSocket)
            return;
        var self = this;
        this._tcpSocket.setTimeout(timeout, function () {
            var _a;
            (_a = self._tcpSocket) === null || _a === void 0 ? void 0 : _a.end();
            if (callback)
                callback();
        });
    };
    ;
    Rcon.prototype._tcpSocketOnData = function (data) {
        if (this.outstandingData != null) {
            data = buffer_1.Buffer.concat([this.outstandingData, data], this.outstandingData.length + data.length);
            this.outstandingData = null;
        }
        while (data.length >= 12) {
            var len = data.readInt32LE(0);
            if (!len)
                return;
            var packetLen = len + 4;
            if (data.length < packetLen)
                break;
            var bodyLen = len - 10;
            if (bodyLen < 0) {
                data = data.slice(packetLen);
                break;
            }
            var id = data.readInt32LE(4);
            var type = data.readInt32LE(8);
            if (id == this.rconId) {
                if (!this.hasAuthed && type == PacketType.RESPONSE_AUTH) {
                    this.hasAuthed = true;
                    this.emit('auth');
                }
                else if (type == PacketType.RESPONSE_VALUE) {
                    var str = data.toString('utf8', 12, 12 + bodyLen);
                    if (str.charAt(str.length - 1) === '\n') {
                        str = str.substring(0, str.length - 1);
                    }
                    this.emit('response', str);
                }
            }
            else if (id == -1) {
                this.emit('error', new Error("Authentication failed"));
            }
            else {
                var str = data.toString('utf8', 12, 12 + bodyLen);
                if (str.charAt(str.length - 1) === '\n') {
                    str = str.substring(0, str.length - 1);
                }
                this.emit('server', str);
            }
            data = data.slice(packetLen);
        }
        this.outstandingData = data;
    };
    ;
    Rcon.prototype.socketOnConnect = function () {
        this.emit('connect');
        this.send(this.password, PacketType.AUTH);
    };
    ;
    Rcon.prototype.socketOnEnd = function () {
        this.emit('end');
        this.hasAuthed = false;
    };
    ;
    return Rcon;
}(events_2.default));
exports.Rcon = Rcon;
module.exports = Rcon;
