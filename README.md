# fillinboard

A whiteboard for managing RFD fillins

# Launching

This application should be launched using the command `pm2 start ecosystem.config.js` where the ecosystem file
has been configured to contain the script start path and the environmental variables needed to run the application

# Single Sign On

All claims and permissions are managed through SSO using Microsoft and SAML.

Environmental variables need to be set providing the information needed to complete the SSO request.

The variables are:

```
const SSO_ENTRY_POINT = process.env.ENTRY_POINT;
const SSO_ISSUER = process.env.ISSUER;
const SSO_APP_CERT = process.env.SSO_CERT;
const SSO_CLAIM_USER = process.env.SSO_CLAIM_USER;
const SSO_CLAIM_ADMIN = process.env.SSO_CLAIM_ADMIN;
```

If these are not setup the application will not work.

_SSO_ENTRY_POINT_ is the URL to the SAML authorization provided by Microsoft
_SSO_ISSUER_ is the name of the application
_SSO_APP_CERT_ is the relative path to the application certificate provided by Microsoft
_SSO_CLAIM_USER_ is the claim group ID that anyone with user or view level access should have
_SSO_CLAIM_ADMIN_ is the claim group ID that anyone with the admin level access should have
