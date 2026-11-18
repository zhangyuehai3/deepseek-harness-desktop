import { describe, it } from 'node:test'
import assert from 'node:assert'
import { publicEncrypt, constants } from 'node:crypto'
import { decryptApiKeyWithPrivateKey, EZAI_RSA_PRIVATE_KEY } from '../src/api.ts'

const SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApiO6281xZ8t2IEVG2I73
o5zzBQI3u7KRCYubEiWcWJsMyf2NRUfv+BXb83v2wbl1W/g6kgsrWMLu9yC7MppZ
VHoe4Y1XZ2gfiGUTe7mZO6GxvPg6D+aksWaQVLdxGd0ZPCwyE5pHBJXYUJGlSO1p
L08ktxU9KgCqQnJkmOa/Us6WGjKJh/iz4vQxhsBLRHkFtuHTHH4yFVupK11UIRzt
loB0QPX0Coo0fLCYXat9hH+xhUeb/0YHSmvSsd3WnjYmuhshvJNRHhbzh/7SNZKG
optLv6eyNMSGTkLrI3FgSetc18uyO/mSPqymxMiCf1eQ9mrMVZ71j4hw83GXeCYv
8QIDAQAB
-----END PUBLIC KEY-----`

describe('EZAI All-API Authentication & Fixed RSA Key Decryption', () => {
  it('correctly decrypts server-encrypted api_key using fixed client private key', () => {
    const rawApiKey = 'sk-dfb957ab39aa4c35860379d322f4784c'

    // Server encrypts using its fixed public key
    const encryptedBuf = publicEncrypt(
      {
        key: SERVER_PUBLIC_KEY,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(rawApiKey, 'utf8'),
    )
    const encryptedBase64 = encryptedBuf.toString('base64')

    // Client decrypts using default fixed private key
    const decrypted = decryptApiKeyWithPrivateKey(encryptedBase64)
    assert.equal(decrypted, rawApiKey)
  })

  it('correctly decrypts with standard PKCS1 padding fallback using fixed private key', () => {
    const rawApiKey = 'sk-pkcs1-fallback-key-test'
    const encryptedBuf = publicEncrypt(
      {
        key: SERVER_PUBLIC_KEY,
        padding: constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(rawApiKey, 'utf8'),
    )
    const encryptedBase64 = encryptedBuf.toString('base64')

    const decrypted = decryptApiKeyWithPrivateKey(encryptedBase64, EZAI_RSA_PRIVATE_KEY)
    assert.equal(decrypted, rawApiKey)
  })

  it('passes through plain-text sk- key without decryption', () => {
    const plainKey = 'sk-already-plaintext-key'
    const res = decryptApiKeyWithPrivateKey(plainKey)
    assert.equal(res, plainKey)
  })
})
