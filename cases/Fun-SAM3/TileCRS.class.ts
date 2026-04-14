export class TileCRS {
  constructor(
    readonly z: number,
    readonly x: number,
    readonly y: number,
  ) {}

  localPixelCoordinatesToFlatMeters(left: number, top: number) {}
}
