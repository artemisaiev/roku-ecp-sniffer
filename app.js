import dgram from 'dgram';
import express from 'express';
import enableWs from 'express-ws';
import path from 'path';
import { readFileSync } from 'fs';
import { v5 as uuidv5 } from 'uuid';
import mustache from 'mustache';
import { uptime } from 'process';
import { networkInterfaces } from 'os';

import config from './config.json' with { type: "json" };

const parseSSDP = (message) => {
    const lines = message.toString().split('\r\n');
    const ssdp = {};
    lines.forEach((line) => {
        const delim = line.indexOf(':');
        if (delim > 1) {
            const key = line.substring(0, delim).trim().toLowerCase();
            const value = line.substring(delim + 1).trim();
            ssdp[key] = value;
        }
    });
    return ssdp;
}

const xmlPayload = (name, data, encode = true) => {
    const xml = readFileSync(data_dir + name + '.xml', { encoding: 'utf8'});
    const content = (data) ? mustache.render(xml, data) : xml;
    return (encode) ? Buffer.from(content).toString('base64') : content;
}

const findInterface = () => {
    const addresses = Object.values(networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat(i.family==='IPv4' && !i.internal && i.address || []), [])), []);
    return addresses[0];
}

const HTTP_PORT = 8060, MCAST_PORT = 1900;

const data_dir = path.resolve() + '/data/';
const uuid = config.uuid || uuidv5(config.sn, '00000000-0000-0000-0000-000000000000');
const bind = config.bind || findInterface();

const ssdp = dgram.createSocket({ type: 'udp4', reuseAddr: true })

ssdp.on('listening', () => {
    ssdp.setBroadcast(true)
    ssdp.setMulticastTTL(1);
    ssdp.addMembership('239.255.255.250');
});

ssdp.on('message', (message, remote) => {
    if (message.toString().includes('M-SEARCH')) {
        const search = parseSSDP(message);
        if (search?.st === 'roku:ecp' && search?.man === '"ssdp:discover"') {
            ssdp.send(`HTTP/1.1 200 OK\r\nCache-Control: max-age=3600\r\nST: roku:ecp\r\nLocation: http://${bind}3:${HTTP_PORT}/\r\nUSN: uuid:roku:ecp:${config.sn}\r\n\r\n`, remote.port, remote.address);
        }
    }
});

ssdp.bind(MCAST_PORT);

const http = express();
http.disable('etag');

enableWs(http);

http.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/xml; charset="utf-8"');
    res.send(xmlPayload('device', { sn: config.sn, uuid: uuid}, false));
});

http.get('/device-image.png', (req, res) => {
    res.sendFile(data_dir + 'device-image.png');
});

http.ws('/ecp-session', (ws, req) => {
    ws.on('message', msg => {
        const request = JSON.parse(msg);

        const response = {
            'response': request['request'],
            'response-id': request['request-id'],
            'status': '200',
            'status-msg': 'OK'
        }

        switch (request['request']) {
            case 'query-apps':
                response['content-data'] = xmlPayload('query-apps', { apps: config.apps });
                response['content-type'] = 'text/xml; charset="utf-8"';
                break;
            case 'query-active-app':
                response['content-data'] = xmlPayload('query-active-app');
                response['content-type'] = 'text/xml; charset="utf-8"';
                break;
            case 'query-media-player':
                response['content-data'] = xmlPayload('query-media-player');
                response['content-type'] = 'text/xml; charset="utf-8"';
                break;
            case 'query-device-info':
                response['content-data'] = xmlPayload('query-device-info', { sn: config.sn, uuid: uuid, uptime: uptime() });
                response['content-type'] = 'text/xml; charset="utf-8"';
                break;
            case 'sync-channels':
                ws.send(JSON.stringify(response));
                ws.send(JSON.stringify({'notify': 'sync-completed', 'timestamp': uptime().toString()}));
                return;
            case 'query-icon':
                response['content-data'] = readFileSync(data_dir + 'channel-icon.png').toString('base64');
                response['content-type'] = 'image/png';
                break;
            case 'authenticate':
            case 'request-events':
                break;
            case 'launch':
                const params = JSON.parse(request['param-params']);
                const contentId = params?.contentid;
                const mediaType = params?.mediatype;
                if (contentId && mediaType)
                    console.log(`Deeplink ---> Channel ID: [${request['param-channel-id']}] contentId: ${contentId} / mediaType: ${mediaType}\r\ncURL: curl --request POST --url 'http://roku_device_ip:8060/launch/${request['param-channel-id']}?contentId=${contentId}&mediaType=${mediaType}' --header 'cache-control: no-cache'\r\n`);
                else
                    console.log(`Launch ---> Channel ID: [${request['param-channel-id']}]\r\n`);
                break;
            case 'key-press':
                console.log(`Press ---> Key: ${request['param-key']}\r\n`);
                break;
            default:
                response['status'] = '404';
                response['status-msg'] = 'Not found';
        }

        ws.send(JSON.stringify(response));
    })
    ws.send(JSON.stringify({'notify': 'authenticate', 'param-challenge': '', 'timestamp': uptime().toString()}));
    ws.timer = setInterval(() => ws.ping(), 5000);
});

http.listen(HTTP_PORT, () => {
    console.log(`Roku ECP sniffer at ${bind}\r\n`);
});
