import { registerDecorator } from "class-validator";
import type { ValidationOptions } from "class-validator";
import { isValidTimeZone } from "../zoned-time.js";

/**
 * Accepts only an IANA zone this runtime recognises.
 *
 * `timezone` was validated as any string at all, which meant a typo was stored happily and
 * only surfaced later as a recurrence computed in the wrong zone. Rejecting it at the edge
 * turns a silent, delayed wrongness into a 400 the client can act on.
 */
export function IsTimeZone(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isTimeZone",
      target: object.constructor,
      propertyName,
      options: options ?? {},
      validator: {
        validate: (value: unknown) => typeof value === "string" && isValidTimeZone(value),
        defaultMessage: () => `${propertyName} must be a valid IANA time zone (e.g. Europe/Paris)`,
      },
    });
  };
}
