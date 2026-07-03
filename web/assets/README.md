# Web assets

This directory is reserved for optional project-specific web assets.

The generic ps2cd web page works without any required asset in this directory. The Rust/WASM core has a built-in boot-logo fallback embedded at compile time.

The optional site-level boot-logo override is stored outside this directory:

```text
web/boot.bmp
````

Files under `web/assets/` are reserved for optional web assets such as icons and order files:

```text
icons/icon.svg    optional SVG icon used by the web page
ps2cd.order     optional ordering rules used when the uploaded project does not provide one
ps2iml.order    legacy ordering rules used when ps2cd.order is absent
```

End users do not need to edit this directory. Project forks can replace or extend it.
