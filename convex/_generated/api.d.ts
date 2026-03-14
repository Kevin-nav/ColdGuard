/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as credential_throttle from "../credential_throttle.js";
import type * as devices from "../devices.js";
import type * as maintenance from "../maintenance.js";
import type * as notifications from "../notifications.js";
import type * as passcodes from "../passcodes.js";
import type * as roles from "../roles.js";
import type * as seeds from "../seeds.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  credential_throttle: typeof credential_throttle;
  devices: typeof devices;
  maintenance: typeof maintenance;
  notifications: typeof notifications;
  passcodes: typeof passcodes;
  roles: typeof roles;
  seeds: typeof seeds;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
