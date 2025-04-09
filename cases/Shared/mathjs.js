import * as acorn from "acorn";

const code = "space A;";
const ast = acorn.parse(code, { ecmaVersion: 2020 });

console.log(JSON.stringify(ast, null, 2));

/**
 * space3 A(100);
 * space3 F(100);
 * space1 M(100);
 *
 * vec3 a in A;
 * vec3 f in F;
 * vec3 p in P;
 * vec3 v in V;
 * float m in M;
 * float dt = 0.016;
 *
 * 
 * a = f / m;
 * p = p +  v * dt + 0.5 * a * dt * dt;
 * v = v + 
 * 
 * => 
 * 
 * const A = new Float32ArrayVec3(100);
 *
 * const a = A.alloc(), a_value = [0, 0, 0];
 * const f = F.alloc(), f_value = [0, 0, 0];
 * const m = M.alloc(), m_value = 0;
 *
 * const a_value = A.get(a)
 * const m_value = M.get(m)
 *
 * F.set(f, a_value[0] * m_value, a_value[1] * m_value, a_value[2] * m_value)
 */

const mathjs = () => {};
