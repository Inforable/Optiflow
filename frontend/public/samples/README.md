# Sample media (placeholders)

`hazy_oil.svg` and `clear_oil.svg` are original illustrations, clearly labelled as such. They are shown as thumbnails when a judge presses "Use sample photo" in the Engineer app; the request itself only sends the `sample` field (`hazy_oil`, `clear_oil`, `voice_hazy`), and the backend uses its canned judgement for that sample.

Replace them with real staged photos before recording the demo:

- `hazy_oil.jpg`: turbine oil shaken with a little water in a clear bottle, photographed against a light (milky, cloudy).
- `clear_oil.jpg`: the same oil without water, clear and bright.

Keep the file names; then update `SAMPLE_MEDIA` in `src/lib/samples.js` to point at the `.jpg` files.
