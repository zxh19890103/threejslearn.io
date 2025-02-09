import * as THREE from "three";

__main__ = (s, c, r) => {
  console.log(THREE, s, c, r);
  console.log("hahhaa!");
  __add_nextframe_fn__((_s, _c, _r) => {
    console.log("hh----!!!?");
  });
};
