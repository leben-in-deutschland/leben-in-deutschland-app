# Android Release Signing

## Durable Rule

The Android application in this repository uses package ID
`org.lebenindeutschland.app`. Confirm that package and the selected Play
Console application before changing signing material.

The known-good release/upload certificate for this application has SHA-1:

```text
DE:8C:92:1E:CE:44:26:6D:5E:55:A0:08:3E:9D:E3:8D:C5:60:57:D0
```

The following certificate belongs to a different Play Console application and
must not replace this repository's signing key:

```text
SHA-1:   D8:95:9E:B6:42:C2:74:99:2E:25:14:25:31:50:98:C7:43:73:22:05
SHA-256: 96:5F:18:24:31:B2:AB:BF:01:E4:1E:5E:98:AD:0C:70:74:00:59:8D:3F:2A:42:B4:AF:37:D7:8B:81:14:FC:BF
```

## Secret Source

The keystore, keystore password, and key alias are stored in 1Password under:

```text
Keystore Leben In deutschland Play Store
```

Do not copy those values into this repository, documentation, logs, prompts,
issues, or pull requests. Derive an unknown alias from the keystore with
`keytool`; do not guess it.

GitHub Actions consumes the signing material through these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`

GitHub does not expose prior secret values. Before overwriting these secrets,
verify that the source keystore and credentials are recoverable from
1Password.

## Production Artifact

The Gradle output `app-release.aab` is unsigned. The signing action also
creates an intermediate `app-release-temp.aab`. Neither file is a production
artifact.

Publish only the signing action's `signedFile` output,
`app-release-signed.aab`. Do not upload the whole bundle output directory or
use an `*.aab` release wildcard.

Before publishing, confirm that `jarsigner` reports the bundle as verified and
that `keytool -printcert -jarfile` reports the known-good SHA-1 above.

## Verification

Inspect a candidate without placing its password on the command line:

```bash
keytool -list -v -keystore "/path/to/release.keystore" |
  grep -E "Alias name:|Entry type:|SHA1:"
```

Use the alias whose entry type is `PrivateKeyEntry`, and confirm the SHA-1
matches the known-good certificate above before updating GitHub.
