# Newbie Launcher 0.1.30

Play with friends — with the right address and clear difficulty levels.

## Server → Share

- New **Share** tab on every local server.
- Detects your **LAN**, **Radmin VPN** and **public** addresses plus the router gateway.
- The address field remembers what you paste and gives you **Copy** and **Test** buttons.
- Tests use a local TCP connection for LAN/Radmin and a public Minecraft status lookup for tunnels and port-forwarded addresses.
- Newcomer-friendly method cards with **Easy / Medium / Hard / Advanced** badges and a **Friends need** label.

## Methods

- **playit.gg — Easy (recommended).** Exact local target (`127.0.0.1:port`), download and tunnel-setup links. Friends only need the playit address and vanilla Minecraft.
- **Port forwarding — Hard.** Shows the LAN target, public address, router gateway link, CGNAT warning and step-by-step router/firewall instructions.
- **Radmin VPN — Medium.** Detects the Radmin IP when the adapter is active and gives friends the exact `RadminIP:port`.
- **ngrok — Medium.** Shows the exact `ngrok tcp <port>` command, download/token links and the free-plan card-verification caveat.
- **Cloudflare Tunnel — Advanced.** Explains the real limitation: Minecraft Java is raw TCP, so friends need cloudflared/WARP (or a client mod) and authentication.
- **Same Wi-Fi / LAN — Easy.** Copy the local network address for players on the same network.
- Added a security warning to enable online mode and the whitelist before sharing a public address.

Everything from 0.1.29 and earlier is included.
