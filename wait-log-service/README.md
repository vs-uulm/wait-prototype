# wait-log-service

Example implementation of a WAIT log service without append-only guarantees.
A public/private key pair can be generated using openssl:

```sh
# private key
openssl ecparam -genkey -name secp521r1 -noout -out private.pem

# public key
openssl ec -in ecdsa-p521-private.pem -pubout -out public.pem 
```

The log service exposes a local HTTP API port 3000.
This behavior can be adjusted with the `PORT` and `HOST` environment variable.
