/*!
 * Node-rcon
 * Copyright(c) 2012 Justin Li <j-li.net>
 * MIT Licensed
 *
 * Remixed by Lukas Sondell, 2022
 */
/// <reference types="node" />
import net from 'net';
import { Buffer } from 'buffer';
import EventEmitter from 'events';
export declare class Rcon extends EventEmitter {
    host: string;
    port: number;
    password: string;
    rconId: number;
    hasAuthed: boolean;
    outstandingData: any;
    _tcpSocket?: net.Socket;
    constructor(host: string, port: number, password: string, id?: number);
    send(data: any, cmd: number, id?: number): void;
    _sendSocket(buf: Buffer): void;
    connect(): void;
    disconnect(): void;
    setTimeout(timeout: number, callback: Function): void;
    _tcpSocketOnData(data: any): void;
    socketOnConnect(): void;
    socketOnEnd(): void;
}
