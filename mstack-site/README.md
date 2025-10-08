# mstack-site

This folder contains the static website for the Artificial Metacognition project. It's published to GitHub Pages via a GitHub Actions workflow that uploads this folder as the Pages artifact.

How to enable Pages

1. Go to your repository Settings → Pages.
2. Set Source to **GitHub Actions**.
3. Verify the Pages URL: `https://apmorey93.github.io/mstack/`.

Quick check (after workflow completes)

```bash
curl -I https://apmorey93.github.io/mstack/ 
curl -I https://apmorey93.github.io/mstack/evidence.html
```

If evidence.html fails to load, ensure `mstack-site/results/results.json` exists and is valid JSON.
