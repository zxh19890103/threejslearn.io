<!--
  Generated Automatically At Fri Mar 28 2025 15:35:14 GMT+0800 (China Standard Time);
  Here You Explain What You want to Explain.
-->

Though this article on `wikipedia`:

[SPH](https://en.wikipedia.org/wiki/Smoothed-particle_hydrodynamics)

Particle is a abtract term, not a physical thing. It's a techqiue to compute the distribution of matters.

### How to calculate the density

```math
{\displaystyle \rho _{i}=\rho ({\boldsymbol {r}}_{i})=\sum _{j}m_{j}W_{ij},}
```

### I use Poly6Kernel

```ts
const coef1 = 315 / (64 * Math.PI * Math.pow(h, 9));
const coef2 = -45 / (PI * pow(h, 6));
const coef3 = 45 / (PI * pow(h, 6));

export const Poly6Kernel = (r: number, h: number): number => {
  if (r >= h) return 0;
  const term = pow(h * h - r * r, 3);
  return coef1 * term;
};
```

```math
W(r, h) = {315 \over {64\pi{h^9}}} {(h^2 - r^2)^3}
```

### How to calculate the pressure for a particle

I got to known how to calculate the pressure at a particle position!

```math
p_i = c^2(\rho_i - \rho_{0})
```

where:

```math
c = 10v_{max}
```

the max of velocity of particle has to be estimated!

### How to caculate the pressure force

```math
{dv_i \over dt} = - {\sum_j}m_j{({p_i\over\rho_i^2}+ {p_j\over\rho_j^2})}\nabla{W_{ij}} + g
```

and,

```math
a_i = {dv_i \over dt}
```

### How to calculate the $\nabla{Wij}$

for $q \ge 3$: $\nabla{Wij}=0$

else for $q \ge 2$

### How to caculate viscosity?

we use Artificial viscosity

while $v_{ij} * {r_{ij}} \ge 0$:

```math
\Pi_{ij} = 0
```

else:

```math
\Pi_{ij} = {\displaystyle {-\alpha \bar c_{ij}\phi_{ij} + \beta\phi_{ij}^2} \over {\bar \rho_{ij}}}
```

where:

```math
\phi_{ij} = {\displaystyle h \mathbf v_{ij} \cdot \mathbf r_{ij}  \over { \Vert \mathbf r_{ij} \Vert ^2 + \eta_h^2 } }
```
