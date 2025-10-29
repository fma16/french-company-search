/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** INPI Username - Your username (email) for the INPI API access. */
  "inpiUsername": string,
  /** INPI Password - Your password for the INPI API access. */
  "inpiPassword": string,
  /** Read Clipboard on Launch - Automatically paste SIREN/SIRET or company name from the clipboard when the extension opens. */
  "autoReadClipboard": boolean,
  /** Output Template - Define your custom output template. Use {{variable}} for placeholders. See documentation for available variables. */
  "outputTemplate"?: unknown
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
}

