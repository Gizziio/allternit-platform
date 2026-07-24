# Pinned official headscale image; config is baked in at build time.
FROM headscale/headscale:0.29.2
COPY config.yaml /etc/headscale/config.yaml
# The stock image's default invocation prints CLI help and exits under Fly
# Machines; start the server explicitly.
CMD ["serve"]
