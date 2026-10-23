// Generated from openapi.yaml. Do not edit by hand.
export const builderPlanJsonSchema: Record<string, unknown> = {
  "type": "object",
  "required": [
    "title",
    "summary",
    "warnings",
    "parts"
  ],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "summary": {
      "type": "string",
      "minLength": 1,
      "maxLength": 800
    },
    "warnings": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "string",
        "maxLength": 240
      }
    },
    "parts": {
      "type": "array",
      "maxItems": 80,
      "items": {
        "type": "object",
        "required": [
          "key",
          "parentKey",
          "kind",
          "name",
          "position",
          "rotation",
          "size",
          "color"
        ],
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 40
          },
          "parentKey": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 40
          },
          "kind": {
            "type": "string",
            "enum": [
              "group",
              "box",
              "plane",
              "terrain",
              "sprite",
              "model",
              "light",
              "camera",
              "ui-panel",
              "ui-text",
              "ui-button",
              "ui-health"
            ]
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80
          },
          "position": {
            "type": "object",
            "required": [
              "x",
              "y",
              "z"
            ],
            "properties": {
              "x": {
                "type": "number",
                "minimum": -20,
                "maximum": 20
              },
              "y": {
                "type": "number",
                "minimum": -20,
                "maximum": 20
              },
              "z": {
                "type": "number",
                "minimum": -20,
                "maximum": 20
              }
            },
            "additionalProperties": false
          },
          "rotation": {
            "type": "object",
            "required": [
              "x",
              "y",
              "z"
            ],
            "properties": {
              "x": {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              "y": {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              "z": {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              }
            },
            "additionalProperties": false
          },
          "size": {
            "type": "object",
            "required": [
              "x",
              "y",
              "z"
            ],
            "properties": {
              "x": {
                "type": "number",
                "minimum": 0.02,
                "maximum": 10
              },
              "y": {
                "type": "number",
                "minimum": 0.02,
                "maximum": 10
              },
              "z": {
                "type": "number",
                "minimum": 0.02,
                "maximum": 10
              }
            },
            "additionalProperties": false
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "opacity": {
            "type": "number",
            "minimum": 0.05,
            "maximum": 1
          },
          "assetId": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 80
          },
          "text": {
            "type": "string",
            "maxLength": 80
          },
          "lightKind": {
            "type": "string",
            "enum": [
              "point",
              "directional",
              "ambient"
            ]
          },
          "intensity": {
            "type": "number",
            "minimum": 0,
            "maximum": 50
          },
          "fov": {
            "type": "number",
            "minimum": 10,
            "maximum": 100
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
};
