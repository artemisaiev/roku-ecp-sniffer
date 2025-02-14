# roku-ecp-sniffer

If you are working on some Roku channel that is already published, as you know, there is no easy way to find the exact deeplink parameters that Roku is sending to your prod channel (from Roku search feed, Roku Continue watching, etc...)

But as a workaround, you can use the Roku mobile app to find the `mediaType` and `contentId` from that deeplink. This can be useful in case you are troubleshooting some deeplinking issues.

**Option 1:**

You can route traffic from the Roku app to the Roku device via your laptop/PC, use a network sniffer and search via HTTP/WebSocket calls. A bit annoying...

**Option 2:**

You can use this app that basically "pretends" it is a real Roku device, accepts ECP calls from the Roku app and outputs the `mediaType` / `contentId` when you launch anything from Roku Search, Continue Watching on mobile.

## Usage
- Clone this repository.
  
- Since this is a node.js app, you should have `node` / `npm`
  
(Roku ECP sniffer developed/tested on macos, so not sure if it works on different OS)
  
- Install the required node modules with `npm install`
  
- Update `config.json`:
```
{
    "sn": "YH0123456789",
    "apps": [
        { "id": "1", "name": "NAME" }
    ]
}
```
Provide the serial number of your real Roku device (if you don't, the Roku app won't let you launch content because this "device" doesn't belong to your Roku account). 
Add the channel(s) you want to debug. You will need the Name and ID of your production channel(s).

- Remember to power off your real Roku device before the next step.

- Run the app with `nmp start`
    
- Run the Roku app on your mobile. You will see your "fake device" in the devices tab. Connect to it:

<img src="https://github.com/user-attachments/assets/f8113fb5-d20a-4b4f-8258-7296c2889261" width="30%" />


- Launch some content from the Roku App. **Finally** you can see the deeplink `mediaType` and `contentId` in the sniffer application output.


