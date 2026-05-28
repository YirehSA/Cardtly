# Android Release Signing

How the Cardtly Android release bundle (AAB) is signed for Google Play upload.

## Keystore Location

The upload keystore lives OUTSIDE this repo (it must never be committed):

    C:\Users\User\.android\cardtly-upload.jks

The accompanying public certificate, used for the Play Console upload-key reset
request, is at:

    C:\Users\User\.android\cardtly-upload-certificate.pem

Keystore details:
- Alias:     cardtly-upload
- Algorithm: RSA 2048
- Validity:  10000 days
- DN:        CN=Andre Nel, O=Yireh Business Solutions, L=Pretoria, ST=Gauteng, C=ZA

## Password Storage

The keystore password lives ONLY in the user's password manager (1Password,
Bitwarden, Apple Keychain, etc.). It is not stored in any file in this repo,
in any tracked config, or in any committed environment file.

If the password is lost, the only recovery path is another upload-key reset
request to Google. Treat it accordingly.

## Building a Signed Release

In a PowerShell session, set the password as an environment variable, then run
the gradle bundle task:

    $env:CARDTLY_KEYSTORE_PASSWORD = "<paste from password manager>"
    cd android
    ./gradlew bundleRelease

The signed AAB will be written to:

    android\app\build\outputs\bundle\release\app-release.aab

The keystore path defaults to `~/.android/cardtly-upload.jks`. To use a different
location (e.g. on another machine), also set `CARDTLY_KEYSTORE_PATH`:

    $env:CARDTLY_KEYSTORE_PATH = "D:\backups\cardtly-upload.jks"

After the build, clear the env var so the password is not left in the shell
session:

    Remove-Item Env:CARDTLY_KEYSTORE_PASSWORD

## Alternative: ~/.gradle/gradle.properties

Instead of setting env vars every session, put the values in your global gradle
properties file (which lives outside any repo, at `C:\Users\User\.gradle\gradle.properties`):

    cardtlyKeystorePath=C:\\Users\\User\\.android\\cardtly-upload.jks
    cardtlyKeystorePassword=<password>

Note the doubled backslashes. The env var takes precedence over the gradle
property if both are set.

## Play Console: Upload Key Registration

Because the original upload keystore was lost, the new public certificate must
be registered with Google before the Play Console will accept builds signed
with this keystore.

1. Go to Play Console > Settings > App integrity > App signing
2. Find the "Upload key certificate" section
3. Click "Request upload key reset"
4. Upload `C:\Users\User\.android\cardtly-upload-certificate.pem`
5. Wait for Google approval (typically same business day)

After approval, releases signed with `cardtly-upload.jks` will be accepted.
The app signing key on Google's side is unchanged, so end users will still
get seamless updates.
