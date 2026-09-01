import { CylinderGeometry, Quaternion, Vector3 } from 'three';

/**
 * A bone: a tapered cylinder baked to run from `from` to `to` in the parent's
 * space. Cheaper than parenting a rotated group per limb, and it keeps the
 * joint angles honest — arms and legs are solved from where the hands and feet
 * actually are, rather than eyeballed as Euler triples.
 *
 * Shared by the poler and the passengers so both are built the same way.
 */
export function limb(from: Vector3, to: Vector3, rTop: number, rBottom: number) {
  const dir = new Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new CylinderGeometry(rTop, rBottom, len, 8);
  geo.translate(0, -len / 2, 0); // hang from the origin, down -Y
  geo.applyQuaternion(
    new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir.clone().normalize())
  );
  geo.translate(from.x, from.y, from.z);
  return geo;
}
