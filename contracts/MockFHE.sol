// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * MockFHE
 *
 * A trivial "mock" implementation of the IFHE interface expected by FHESealedBid.
 * It stores uint64 values in bytes via abi.encode and performs plain comparisons.
 * DO NOT USE IN PRODUCTION.
 */
contract MockFHE {
    struct Ciphertext { bytes data; }

    function encryptUint64(uint64 value, bytes calldata /*publicKey*/)
        external
        pure
        returns (Ciphertext memory)
    {
        return Ciphertext({ data: abi.encode(value) });
    }

    function compareCiphertexts(Ciphertext calldata a, Ciphertext calldata b)
        external
        pure
        returns (bool isAGreaterOrEqual)
    {
        uint64 av = _decode(a.data);
        uint64 bv = _decode(b.data);
        return av >= bv;
    }

    function selectCiphertext(bool cond, Ciphertext calldata a, Ciphertext calldata b)
        external
        pure
        returns (Ciphertext memory)
    {
        return cond ? a : b;
    }

    function reencrypt(Ciphertext calldata c, bytes calldata /*newPublicKey*/)
        external
        pure
        returns (Ciphertext memory)
    {
        return c;
    }

    function _decode(bytes memory data) private pure returns (uint64 v) {
        require(data.length >= 32, "bad ct");
        assembly { v := mload(add(data, 32)) }
    }
}


