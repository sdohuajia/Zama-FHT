# 基于 FHE 的密封拍卖（架构与原型）

本项目提供一个最小但具有“有意义 FHE 使用”的架构示例：在 Solidity 合约中进行密封出价拍卖。为保持链无关性，FHE 原语通过接口抽象，可接入 fhEVM 或其它 FHE 方案。

## 特性
- 投标者以加密密文提交出价（每个投标者使用临时公钥）
- 揭示阶段通过“重加密到拍卖公钥”并在链上进行隐私保护的最大值选择
- 仅在最终阶段暴露“加密的中标价”，卖家可离线解密

## 技术栈
- Hardhat + TypeScript
- Solidity 0.8.26

## 安装
```bash
npm install
```

## 构建
```bash
npm run build
```

## 本地部署（示例）
```bash
npx hardhat node &
npm run deploy
```

## 合约说明
- `contracts/FHESealedBid.sol`：包含 `IFHE` 接口与 `FHESealedBid` 逻辑。
- 将 `IFHE` 替换为具体 FHE 预编译/库并实现：
  - `encryptUint64(uint64, pk)`
  - `compareCiphertexts(a,b)` 返回 a 是否 ≥ b
  - `selectCiphertext(cond, a, b)` 返回 cond ? a : b
  - `reencrypt(c, newPk)` 在揭示阶段重加密到拍卖公钥

## 有意义的 FHE 使用
- 出价端到端保持加密；合约在不解密的情况下更新“加密的最大值”
- 中标者身份公开，但价格保持加密直到离线解密
- 若底层 FHE 支持区间证明，也可采用“只验证不比较”的流程

## 示例脚本
参见 `scripts/example-flow.ts`（内含示例密文；接入你的 FHE SDK 后替换）。

## 安全与生产建议
- 可增加提交-揭示或押金惩罚机制降低作恶
- 校验密文格式与域隔离
- 考虑防重放与每次拍卖专用密钥
