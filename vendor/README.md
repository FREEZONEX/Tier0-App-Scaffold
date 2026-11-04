# Cloud App SDK archive

The scaffold pins the local aenv-next prerelease `@tier0/sdk-v2@0.10.0-aenv.5` (built from the
SDK feature branch, not published to npm), which contains
platform, data, Stream request and real-time message APIs. It targets the Cloud
OpenAPI v2 contract. The lockfile and tests verify the archive integrity.

SHA256: `46dfee8bbc5c4f9ff6aecbc394454f57be7d92a5945e9b6df911ef5fd311e694`. The 0.10.0-aenv.5 archive was packed while four SDK contract baseline tests fail (the Backend's `edgeNodesList` and `sourceDocumentStateUpdate` are not exposed yet; see the SDK CHANGELOG). Historical archives are retained for provenance and are
not installed by this scaffold. Updating the template does not update existing
Apps or prove deployment and live authorization.
