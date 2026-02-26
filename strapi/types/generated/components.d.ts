import type { Schema, Struct } from '@strapi/strapi';

export interface ActionApiConfig extends Struct.ComponentSchema {
  collectionName: 'components_action_api_configs';
  info: {
    description: 'Configuration for API-type actions';
    displayName: 'API Config';
  };
  attributes: {
    body_template: Schema.Attribute.Text;
    headers: Schema.Attribute.JSON;
    method: Schema.Attribute.Enumeration<
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'GET'>;
    timeout_ms: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<30000>;
    url_template: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ActionBashConfig extends Struct.ComponentSchema {
  collectionName: 'components_action_bash_configs';
  info: {
    description: 'Configuration for bash-type actions';
    displayName: 'Bash Config';
  };
  attributes: {
    allowed_commands: Schema.Attribute.JSON;
    command_template: Schema.Attribute.Text & Schema.Attribute.Required;
    timeout_ms: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<30000>;
    working_directory: Schema.Attribute.String;
  };
}

export interface ActionCompositeConfig extends Struct.ComponentSchema {
  collectionName: 'components_action_composite_configs';
  info: {
    description: 'Configuration for composite-type actions (multi-step workflows)';
    displayName: 'Composite Config';
  };
  attributes: {
    steps: Schema.Attribute.JSON & Schema.Attribute.Required;
    stop_on_error: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface ActionParameter extends Struct.ComponentSchema {
  collectionName: 'components_action_parameters';
  info: {
    description: 'A parameter definition for an action';
    displayName: 'Parameter';
  };
  attributes: {
    default_value: Schema.Attribute.String;
    description: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    type: Schema.Attribute.Enumeration<['string', 'number', 'boolean']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'string'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'action.api-config': ActionApiConfig;
      'action.bash-config': ActionBashConfig;
      'action.composite-config': ActionCompositeConfig;
      'action.parameter': ActionParameter;
    }
  }
}
