import * as THREE from "three";

export const blendDistFactors = [
  { label: "ZeroFactor", value: THREE.ZeroFactor },
  { label: "OneFactor", value: THREE.OneFactor },
  { label: "SrcColorFactor", value: THREE.SrcColorFactor },
  { label: "OneMinusSrcColorFactor", value: THREE.OneMinusSrcColorFactor },
  { label: "SrcAlphaFactor", value: THREE.SrcAlphaFactor },
  { label: "OneMinusSrcAlphaFactor", value: THREE.OneMinusSrcAlphaFactor },
  { label: "DstAlphaFactor", value: THREE.DstAlphaFactor },
  { label: "OneMinusDstAlphaFactor", value: THREE.OneMinusDstAlphaFactor },
  { label: "DstColorFactor", value: THREE.DstColorFactor },
  { label: "OneMinusDstColorFactor", value: THREE.OneMinusDstColorFactor },
  { label: "ConstantColorFactor", value: THREE.ConstantColorFactor },
  {
    label: "OneMinusConstantColorFactor",
    value: THREE.OneMinusConstantColorFactor,
  },
  { label: "ConstantAlphaFactor", value: THREE.ConstantAlphaFactor },
  {
    label: "OneMinusConstantAlphaFactor",
    value: THREE.OneMinusConstantAlphaFactor,
  },
];

export const blendSrcFactors = [
  ...blendDistFactors,
  {
    label: "SrcAlphaSaturateFactor",
    value: THREE.SrcAlphaSaturateFactor,
  },
];

export const blendEqs = [
  {
    label: "AddEquation",
    value: THREE.AddEquation,
  },
  {
    label: "SubtractEquation",
    value: THREE.SubtractEquation,
  },
  {
    label: "ReverseSubtractEquation",
    value: THREE.ReverseSubtractEquation,
  },
  {
    label: "MinEquation",
    value: THREE.MinEquation,
  },
  {
    label: "MaxEquation",
    value: THREE.MaxEquation,
  },
];

export const blendings = [
  {
    label: "NoBlending",
    value: THREE.NoBlending,
  },
  {
    label: "NormalBlending",
    value: THREE.NormalBlending,
  },
  {
    label: "AdditiveBlending",
    value: THREE.AdditiveBlending,
  },
  {
    label: "SubtractiveBlending",
    value: THREE.SubtractiveBlending,
  },
  {
    label: "MultiplyBlending",
    value: THREE.MultiplyBlending,
  },
  {
    label: "CustomBlending",
    value: THREE.CustomBlending,
  },
];
