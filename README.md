# Stuffed Pals

A phone-width game for Cora. Snap a stuffed animal with the camera and that photo becomes a pal on the shelf. You can keep more than one.

With each pal you can:

- Talk. Type a short line, or speak one if the phone can hear you. The pal answers that line, using words you just said.
- Feed it a snack.
- Dress it up and give it a makeup look.

Photos and pals stay in this browser (`localStorage`). There is no account and no server. Replies are written on the device from your words. They are not from a live model.

If the camera is blocked, the game says so and lets you try again.

## Play

```bash
npm install
npm run dev
```

Open http://localhost:5173 on your phone or computer and allow the camera. The live camera is the main path. **Open the camera app** uses the phone capture input when you need it.

## Scripts

- `npm run dev` — play locally
- `npm test` — check the on-device replies
- `npm run build` — static build in `dist/`
