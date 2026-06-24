/** 细节层 LOD 已关闭（用户要求全细节）：任何缩放都画全部细节层（换热器管束/容器支腿/刻度线…），
 *  不再随缩小自动隐藏。保留 `showDetail(scale)` 签名供各符号沿用，恒返回 true。
 *  （曾用阈值 0.7 在缩小总览时隐藏细线保持 P&ID 干净；现统一全显——代价是上千节点大图缩小会偏密。） */
export function showDetail(_scale?: number): boolean {
  return true;
}
