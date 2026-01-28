-- kengoDB.Puestos definition

CREATE TABLE `Puestos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `puesto` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.categorias definition

CREATE TABLE `categorias` (
  `id_categoria` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre_categoria` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_categoria`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.codigos_recuperacion definition

CREATE TABLE `codigos_recuperacion` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date_created` timestamp NULL DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `codigo` varchar(255) DEFAULT NULL,
  `fecha_expiracion` datetime DEFAULT NULL,
  `intentos_fallidos` int DEFAULT '0',
  `usado` tinyint(1) DEFAULT '0',
  `ip_solicitante` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.codigos_verificacion_email definition

CREATE TABLE `codigos_verificacion_email` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date_created` timestamp NULL DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `codigo` varchar(255) DEFAULT NULL,
  `fecha_expiracion` datetime DEFAULT NULL,
  `intentos_fallidos` int DEFAULT '0',
  `usado` tinyint(1) DEFAULT '0',
  `ip_solicitante` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_activity definition

CREATE TABLE `directus_activity` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(45) NOT NULL,
  `user` char(36) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(50) DEFAULT NULL,
  `user_agent` text,
  `collection` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `origin` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_activity_collection_foreign` (`collection`),
  KEY `directus_activity_timestamp_index` (`timestamp`)
) ENGINE=InnoDB AUTO_INCREMENT=4356 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_extensions definition

CREATE TABLE `directus_extensions` (
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `id` char(36) NOT NULL,
  `folder` varchar(255) NOT NULL,
  `source` varchar(255) NOT NULL,
  `bundle` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_fields definition

CREATE TABLE `directus_fields` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `collection` varchar(64) NOT NULL,
  `field` varchar(64) NOT NULL,
  `special` varchar(64) DEFAULT NULL,
  `interface` varchar(64) DEFAULT NULL,
  `options` json DEFAULT NULL,
  `display` varchar(64) DEFAULT NULL,
  `display_options` json DEFAULT NULL,
  `readonly` tinyint(1) NOT NULL DEFAULT '0',
  `hidden` tinyint(1) NOT NULL DEFAULT '0',
  `sort` int unsigned DEFAULT NULL,
  `width` varchar(30) DEFAULT 'full',
  `translations` json DEFAULT NULL,
  `note` text,
  `conditions` json DEFAULT NULL,
  `required` tinyint(1) DEFAULT '0',
  `group` varchar(64) DEFAULT NULL,
  `validation` json DEFAULT NULL,
  `validation_message` text,
  `searchable` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `directus_fields_collection_foreign` (`collection`)
) ENGINE=InnoDB AUTO_INCREMENT=330 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_migrations definition

CREATE TABLE `directus_migrations` (
  `version` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_policies definition

CREATE TABLE `directus_policies` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(64) NOT NULL DEFAULT 'badge',
  `description` text,
  `ip_access` text,
  `enforce_tfa` tinyint(1) NOT NULL DEFAULT '0',
  `admin_access` tinyint(1) NOT NULL DEFAULT '0',
  `app_access` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_relations definition

CREATE TABLE `directus_relations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `many_collection` varchar(64) NOT NULL,
  `many_field` varchar(64) NOT NULL,
  `one_collection` varchar(64) DEFAULT NULL,
  `one_field` varchar(64) DEFAULT NULL,
  `one_collection_field` varchar(64) DEFAULT NULL,
  `one_allowed_collections` text,
  `junction_field` varchar(64) DEFAULT NULL,
  `sort_field` varchar(64) DEFAULT NULL,
  `one_deselect_action` varchar(255) NOT NULL DEFAULT 'nullify',
  PRIMARY KEY (`id`),
  KEY `directus_relations_many_collection_foreign` (`many_collection`),
  KEY `directus_relations_one_collection_foreign` (`one_collection`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_translations definition

CREATE TABLE `directus_translations` (
  `id` char(36) NOT NULL,
  `language` varchar(255) NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_collections definition

CREATE TABLE `directus_collections` (
  `collection` varchar(64) NOT NULL,
  `icon` varchar(64) DEFAULT NULL,
  `note` text,
  `display_template` varchar(255) DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT '0',
  `singleton` tinyint(1) NOT NULL DEFAULT '0',
  `translations` json DEFAULT NULL,
  `archive_field` varchar(64) DEFAULT NULL,
  `archive_app_filter` tinyint(1) NOT NULL DEFAULT '1',
  `archive_value` varchar(255) DEFAULT NULL,
  `unarchive_value` varchar(255) DEFAULT NULL,
  `sort_field` varchar(64) DEFAULT NULL,
  `accountability` varchar(255) DEFAULT 'all',
  `color` varchar(255) DEFAULT NULL,
  `item_duplication_fields` json DEFAULT NULL,
  `sort` int DEFAULT NULL,
  `group` varchar(64) DEFAULT NULL,
  `collapse` varchar(255) NOT NULL DEFAULT 'open',
  `preview_url` varchar(255) DEFAULT NULL,
  `versioning` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`collection`),
  KEY `directus_collections_group_foreign` (`group`),
  CONSTRAINT `directus_collections_group_foreign` FOREIGN KEY (`group`) REFERENCES `directus_collections` (`collection`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_folders definition

CREATE TABLE `directus_folders` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `parent` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_folders_parent_foreign` (`parent`),
  CONSTRAINT `directus_folders_parent_foreign` FOREIGN KEY (`parent`) REFERENCES `directus_folders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_permissions definition

CREATE TABLE `directus_permissions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `collection` varchar(64) NOT NULL,
  `action` varchar(10) NOT NULL,
  `permissions` json DEFAULT NULL,
  `validation` json DEFAULT NULL,
  `presets` json DEFAULT NULL,
  `fields` text,
  `policy` char(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_permissions_collection_foreign` (`collection`),
  KEY `directus_permissions_policy_foreign` (`policy`),
  CONSTRAINT `directus_permissions_policy_foreign` FOREIGN KEY (`policy`) REFERENCES `directus_policies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_roles definition

CREATE TABLE `directus_roles` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(64) NOT NULL DEFAULT 'supervised_user_circle',
  `description` text,
  `parent` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_roles_parent_foreign` (`parent`),
  CONSTRAINT `directus_roles_parent_foreign` FOREIGN KEY (`parent`) REFERENCES `directus_roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_users definition

CREATE TABLE `directus_users` (
  `id` char(36) NOT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `email` varchar(128) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `title` varchar(50) DEFAULT NULL,
  `description` text,
  `tags` json DEFAULT NULL,
  `avatar` char(36) DEFAULT NULL,
  `language` varchar(255) DEFAULT NULL,
  `tfa_secret` varchar(255) DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `role` char(36) DEFAULT NULL,
  `token` varchar(255) DEFAULT NULL,
  `last_access` timestamp NULL DEFAULT NULL,
  `last_page` varchar(255) DEFAULT NULL,
  `provider` varchar(128) NOT NULL DEFAULT 'default',
  `external_identifier` varchar(255) DEFAULT NULL,
  `auth_data` json DEFAULT NULL,
  `email_notifications` tinyint(1) DEFAULT '1',
  `appearance` varchar(255) DEFAULT NULL,
  `theme_dark` varchar(255) DEFAULT NULL,
  `theme_light` varchar(255) DEFAULT NULL,
  `theme_light_overrides` json DEFAULT NULL,
  `theme_dark_overrides` json DEFAULT NULL,
  `text_direction` varchar(255) NOT NULL DEFAULT 'auto',
  `telefono` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `postal` varchar(255) DEFAULT NULL,
  `magic_link_url` text,
  `numero_colegiado` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `directus_users_external_identifier_unique` (`external_identifier`),
  UNIQUE KEY `directus_users_email_unique` (`email`),
  UNIQUE KEY `directus_users_token_unique` (`token`),
  KEY `directus_users_role_foreign` (`role`),
  CONSTRAINT `directus_users_role_foreign` FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_versions definition

CREATE TABLE `directus_versions` (
  `id` char(36) NOT NULL,
  `key` varchar(64) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `collection` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `hash` varchar(255) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  `user_updated` char(36) DEFAULT NULL,
  `delta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_versions_collection_foreign` (`collection`),
  KEY `directus_versions_user_created_foreign` (`user_created`),
  KEY `directus_versions_user_updated_foreign` (`user_updated`),
  CONSTRAINT `directus_versions_collection_foreign` FOREIGN KEY (`collection`) REFERENCES `directus_collections` (`collection`) ON DELETE CASCADE,
  CONSTRAINT `directus_versions_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `directus_versions_user_updated_foreign` FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.rutinas definition

CREATE TABLE `rutinas` (
  `id_rutina` int unsigned NOT NULL AUTO_INCREMENT,
  `user_created` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `user_updated` char(36) DEFAULT NULL,
  `date_updated` timestamp NULL DEFAULT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `autor` char(36) DEFAULT NULL,
  `visibilidad` varchar(255) DEFAULT 'privado',
  PRIMARY KEY (`id_rutina`),
  KEY `rutinas_user_created_foreign` (`user_created`),
  KEY `rutinas_user_updated_foreign` (`user_updated`),
  KEY `rutinas_autor_foreign` (`autor`),
  CONSTRAINT `rutinas_autor_foreign` FOREIGN KEY (`autor`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rutinas_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`),
  CONSTRAINT `rutinas_user_updated_foreign` FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.tokens_acceso_usuario definition

CREATE TABLE `tokens_acceso_usuario` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_created` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `id_usuario` char(36) DEFAULT NULL,
  `token` varchar(255) DEFAULT NULL,
  `usos_actuales` int DEFAULT '0',
  `usos_maximos` int DEFAULT NULL,
  `fecha_expiracion` datetime DEFAULT NULL,
  `ultimo_uso` datetime DEFAULT NULL,
  `activo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `tokens_acceso_usuario_user_created_foreign` (`user_created`),
  KEY `tokens_acceso_usuario_id_usuario_foreign` (`id_usuario`),
  CONSTRAINT `tokens_acceso_usuario_id_usuario_foreign` FOREIGN KEY (`id_usuario`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tokens_acceso_usuario_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.Planes definition

CREATE TABLE `Planes` (
  `id_plan` int unsigned NOT NULL AUTO_INCREMENT,
  `user_created` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `user_updated` char(36) DEFAULT NULL,
  `date_updated` timestamp NULL DEFAULT NULL,
  `titulo` varchar(255) DEFAULT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` varchar(255) DEFAULT 'borrador',
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_fin` datetime DEFAULT NULL,
  `paciente` char(36) DEFAULT NULL,
  `fisio` char(36) DEFAULT NULL,
  PRIMARY KEY (`id_plan`),
  KEY `planes_user_created_foreign` (`user_created`),
  KEY `planes_user_updated_foreign` (`user_updated`),
  KEY `planes_paciente_foreign` (`paciente`),
  KEY `planes_fisio_foreign` (`fisio`),
  CONSTRAINT `planes_fisio_foreign` FOREIGN KEY (`fisio`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `planes_paciente_foreign` FOREIGN KEY (`paciente`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `planes_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`),
  CONSTRAINT `planes_user_updated_foreign` FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.detalle_usuario definition

CREATE TABLE `detalle_usuario` (
  `id_detalle_usuario` int unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` char(36) DEFAULT NULL,
  `dni` varchar(255) DEFAULT NULL,
  `fecha_nacimiento` datetime DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `postal` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `sexo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_detalle_usuario`),
  KEY `detalle_usuario_id_usuario_foreign` (`id_usuario`),
  CONSTRAINT `detalle_usuario_id_usuario_foreign` FOREIGN KEY (`id_usuario`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.detalle_usuario_clinica definition

CREATE TABLE `detalle_usuario_clinica` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `detalle_usuario_id_detalle_usuario` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `detalle_usuario_clinica_detalle_usuario_id___73a89b1_foreign` (`detalle_usuario_id_detalle_usuario`),
  CONSTRAINT `detalle_usuario_clinica_detalle_usuario_id___73a89b1_foreign` FOREIGN KEY (`detalle_usuario_id_detalle_usuario`) REFERENCES `detalle_usuario` (`id_detalle_usuario`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_access definition

CREATE TABLE `directus_access` (
  `id` char(36) NOT NULL,
  `role` char(36) DEFAULT NULL,
  `user` char(36) DEFAULT NULL,
  `policy` char(36) NOT NULL,
  `sort` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_access_role_foreign` (`role`),
  KEY `directus_access_user_foreign` (`user`),
  KEY `directus_access_policy_foreign` (`policy`),
  CONSTRAINT `directus_access_policy_foreign` FOREIGN KEY (`policy`) REFERENCES `directus_policies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_access_role_foreign` FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_access_user_foreign` FOREIGN KEY (`user`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_comments definition

CREATE TABLE `directus_comments` (
  `id` char(36) NOT NULL,
  `collection` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `comment` text NOT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  `user_updated` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_comments_user_created_foreign` (`user_created`),
  KEY `directus_comments_user_updated_foreign` (`user_updated`),
  CONSTRAINT `directus_comments_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `directus_comments_user_updated_foreign` FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_dashboards definition

CREATE TABLE `directus_dashboards` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `icon` varchar(64) NOT NULL DEFAULT 'dashboard',
  `note` text,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_dashboards_user_created_foreign` (`user_created`),
  CONSTRAINT `directus_dashboards_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_files definition

CREATE TABLE `directus_files` (
  `id` char(36) NOT NULL,
  `storage` varchar(255) NOT NULL,
  `filename_disk` varchar(255) DEFAULT NULL,
  `filename_download` varchar(255) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `folder` char(36) DEFAULT NULL,
  `uploaded_by` char(36) DEFAULT NULL,
  `created_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_by` char(36) DEFAULT NULL,
  `modified_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `charset` varchar(50) DEFAULT NULL,
  `filesize` bigint DEFAULT NULL,
  `width` int unsigned DEFAULT NULL,
  `height` int unsigned DEFAULT NULL,
  `duration` int unsigned DEFAULT NULL,
  `embed` varchar(200) DEFAULT NULL,
  `description` text,
  `location` text,
  `tags` text,
  `metadata` json DEFAULT NULL,
  `focal_point_x` int DEFAULT NULL,
  `focal_point_y` int DEFAULT NULL,
  `tus_id` varchar(64) DEFAULT NULL,
  `tus_data` json DEFAULT NULL,
  `uploaded_on` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_files_uploaded_by_foreign` (`uploaded_by`),
  KEY `directus_files_modified_by_foreign` (`modified_by`),
  KEY `directus_files_folder_foreign` (`folder`),
  CONSTRAINT `directus_files_folder_foreign` FOREIGN KEY (`folder`) REFERENCES `directus_folders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `directus_files_modified_by_foreign` FOREIGN KEY (`modified_by`) REFERENCES `directus_users` (`id`),
  CONSTRAINT `directus_files_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_flows definition

CREATE TABLE `directus_flows` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `icon` varchar(64) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  `description` text,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `trigger` varchar(255) DEFAULT NULL,
  `accountability` varchar(255) DEFAULT 'all',
  `options` json DEFAULT NULL,
  `operation` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `directus_flows_operation_unique` (`operation`),
  KEY `directus_flows_user_created_foreign` (`user_created`),
  CONSTRAINT `directus_flows_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_notifications definition

CREATE TABLE `directus_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(255) DEFAULT 'inbox',
  `recipient` char(36) NOT NULL,
  `sender` char(36) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text,
  `collection` varchar(64) DEFAULT NULL,
  `item` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_notifications_recipient_foreign` (`recipient`),
  KEY `directus_notifications_sender_foreign` (`sender`),
  CONSTRAINT `directus_notifications_recipient_foreign` FOREIGN KEY (`recipient`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_notifications_sender_foreign` FOREIGN KEY (`sender`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_operations definition

CREATE TABLE `directus_operations` (
  `id` char(36) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `key` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `position_x` int NOT NULL,
  `position_y` int NOT NULL,
  `options` json DEFAULT NULL,
  `resolve` char(36) DEFAULT NULL,
  `reject` char(36) DEFAULT NULL,
  `flow` char(36) NOT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `directus_operations_resolve_unique` (`resolve`),
  UNIQUE KEY `directus_operations_reject_unique` (`reject`),
  KEY `directus_operations_flow_foreign` (`flow`),
  KEY `directus_operations_user_created_foreign` (`user_created`),
  CONSTRAINT `directus_operations_flow_foreign` FOREIGN KEY (`flow`) REFERENCES `directus_flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_operations_reject_foreign` FOREIGN KEY (`reject`) REFERENCES `directus_operations` (`id`),
  CONSTRAINT `directus_operations_resolve_foreign` FOREIGN KEY (`resolve`) REFERENCES `directus_operations` (`id`),
  CONSTRAINT `directus_operations_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_panels definition

CREATE TABLE `directus_panels` (
  `id` char(36) NOT NULL,
  `dashboard` char(36) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `icon` varchar(64) DEFAULT NULL,
  `color` varchar(10) DEFAULT NULL,
  `show_header` tinyint(1) NOT NULL DEFAULT '0',
  `note` text,
  `type` varchar(255) NOT NULL,
  `position_x` int NOT NULL,
  `position_y` int NOT NULL,
  `width` int NOT NULL,
  `height` int NOT NULL,
  `options` json DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_created` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_panels_dashboard_foreign` (`dashboard`),
  KEY `directus_panels_user_created_foreign` (`user_created`),
  CONSTRAINT `directus_panels_dashboard_foreign` FOREIGN KEY (`dashboard`) REFERENCES `directus_dashboards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_panels_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_presets definition

CREATE TABLE `directus_presets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `bookmark` varchar(255) DEFAULT NULL,
  `user` char(36) DEFAULT NULL,
  `role` char(36) DEFAULT NULL,
  `collection` varchar(64) DEFAULT NULL,
  `search` varchar(100) DEFAULT NULL,
  `layout` varchar(100) DEFAULT 'tabular',
  `layout_query` json DEFAULT NULL,
  `layout_options` json DEFAULT NULL,
  `refresh_interval` int DEFAULT NULL,
  `filter` json DEFAULT NULL,
  `icon` varchar(64) DEFAULT 'bookmark',
  `color` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_presets_collection_foreign` (`collection`),
  KEY `directus_presets_user_foreign` (`user`),
  KEY `directus_presets_role_foreign` (`role`),
  CONSTRAINT `directus_presets_role_foreign` FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_presets_user_foreign` FOREIGN KEY (`user`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_revisions definition

CREATE TABLE `directus_revisions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `activity` int unsigned NOT NULL,
  `collection` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `data` json DEFAULT NULL,
  `delta` json DEFAULT NULL,
  `parent` int unsigned DEFAULT NULL,
  `version` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_revisions_collection_foreign` (`collection`),
  KEY `directus_revisions_parent_foreign` (`parent`),
  KEY `directus_revisions_activity_foreign` (`activity`),
  KEY `directus_revisions_version_foreign` (`version`),
  CONSTRAINT `directus_revisions_activity_foreign` FOREIGN KEY (`activity`) REFERENCES `directus_activity` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_revisions_parent_foreign` FOREIGN KEY (`parent`) REFERENCES `directus_revisions` (`id`),
  CONSTRAINT `directus_revisions_version_foreign` FOREIGN KEY (`version`) REFERENCES `directus_versions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3191 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_settings definition

CREATE TABLE `directus_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_name` varchar(100) NOT NULL DEFAULT 'Directus',
  `project_url` varchar(255) DEFAULT NULL,
  `project_color` varchar(255) NOT NULL DEFAULT '#6644FF',
  `project_logo` char(36) DEFAULT NULL,
  `public_foreground` char(36) DEFAULT NULL,
  `public_background` char(36) DEFAULT NULL,
  `public_note` text,
  `auth_login_attempts` int unsigned DEFAULT '25',
  `auth_password_policy` varchar(100) DEFAULT NULL,
  `storage_asset_transform` varchar(7) DEFAULT 'all',
  `storage_asset_presets` json DEFAULT NULL,
  `custom_css` text,
  `storage_default_folder` char(36) DEFAULT NULL,
  `basemaps` json DEFAULT NULL,
  `mapbox_key` varchar(255) DEFAULT NULL,
  `module_bar` json DEFAULT NULL,
  `project_descriptor` varchar(100) DEFAULT NULL,
  `default_language` varchar(255) NOT NULL DEFAULT 'en-US',
  `custom_aspect_ratios` json DEFAULT NULL,
  `public_favicon` char(36) DEFAULT NULL,
  `default_appearance` varchar(255) NOT NULL DEFAULT 'auto',
  `default_theme_light` varchar(255) DEFAULT NULL,
  `theme_light_overrides` json DEFAULT NULL,
  `default_theme_dark` varchar(255) DEFAULT NULL,
  `theme_dark_overrides` json DEFAULT NULL,
  `report_error_url` varchar(255) DEFAULT NULL,
  `report_bug_url` varchar(255) DEFAULT NULL,
  `report_feature_url` varchar(255) DEFAULT NULL,
  `public_registration` tinyint(1) NOT NULL DEFAULT '0',
  `public_registration_verify_email` tinyint(1) NOT NULL DEFAULT '1',
  `public_registration_role` char(36) DEFAULT NULL,
  `public_registration_email_filter` json DEFAULT NULL,
  `visual_editor_urls` json DEFAULT NULL,
  `project_id` char(36) DEFAULT NULL,
  `mcp_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `mcp_allow_deletes` tinyint(1) NOT NULL DEFAULT '0',
  `mcp_prompts_collection` varchar(255) DEFAULT NULL,
  `mcp_system_prompt_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `mcp_system_prompt` text,
  `project_owner` varchar(255) DEFAULT NULL,
  `project_usage` varchar(255) DEFAULT NULL,
  `org_name` varchar(255) DEFAULT NULL,
  `product_updates` tinyint(1) DEFAULT NULL,
  `project_status` varchar(255) DEFAULT NULL,
  `ai_openai_api_key` text,
  `ai_anthropic_api_key` text,
  `ai_system_prompt` text,
  PRIMARY KEY (`id`),
  KEY `directus_settings_project_logo_foreign` (`project_logo`),
  KEY `directus_settings_public_foreground_foreign` (`public_foreground`),
  KEY `directus_settings_public_background_foreign` (`public_background`),
  KEY `directus_settings_storage_default_folder_foreign` (`storage_default_folder`),
  KEY `directus_settings_public_favicon_foreign` (`public_favicon`),
  KEY `directus_settings_public_registration_role_foreign` (`public_registration_role`),
  CONSTRAINT `directus_settings_project_logo_foreign` FOREIGN KEY (`project_logo`) REFERENCES `directus_files` (`id`),
  CONSTRAINT `directus_settings_public_background_foreign` FOREIGN KEY (`public_background`) REFERENCES `directus_files` (`id`),
  CONSTRAINT `directus_settings_public_favicon_foreign` FOREIGN KEY (`public_favicon`) REFERENCES `directus_files` (`id`),
  CONSTRAINT `directus_settings_public_foreground_foreign` FOREIGN KEY (`public_foreground`) REFERENCES `directus_files` (`id`),
  CONSTRAINT `directus_settings_public_registration_role_foreign` FOREIGN KEY (`public_registration_role`) REFERENCES `directus_roles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `directus_settings_storage_default_folder_foreign` FOREIGN KEY (`storage_default_folder`) REFERENCES `directus_folders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_shares definition

CREATE TABLE `directus_shares` (
  `id` char(36) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `collection` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `role` char(36) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `user_created` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_start` timestamp NULL DEFAULT NULL,
  `date_end` timestamp NULL DEFAULT NULL,
  `times_used` int DEFAULT '0',
  `max_uses` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `directus_shares_role_foreign` (`role`),
  KEY `directus_shares_user_created_foreign` (`user_created`),
  KEY `directus_shares_collection_foreign` (`collection`),
  CONSTRAINT `directus_shares_collection_foreign` FOREIGN KEY (`collection`) REFERENCES `directus_collections` (`collection`) ON DELETE CASCADE,
  CONSTRAINT `directus_shares_role_foreign` FOREIGN KEY (`role`) REFERENCES `directus_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_shares_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.ejercicios definition

CREATE TABLE `ejercicios` (
  `id_ejercicio` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre_ejercicio` varchar(255) DEFAULT NULL,
  `series_defecto` varchar(255) DEFAULT '3',
  `repeticiones_defecto` varchar(255) DEFAULT '15',
  `video` char(36) DEFAULT NULL,
  `portada` char(36) DEFAULT NULL,
  `descripcion` text,
  PRIMARY KEY (`id_ejercicio`),
  KEY `ejercicios_video_foreign` (`video`),
  KEY `ejercicios_portada_foreign` (`portada`),
  CONSTRAINT `ejercicios_portada_foreign` FOREIGN KEY (`portada`) REFERENCES `directus_files` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ejercicios_video_foreign` FOREIGN KEY (`video`) REFERENCES `directus_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.ejercicios_categorias definition

CREATE TABLE `ejercicios_categorias` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ejercicios_id_ejercicio` int unsigned DEFAULT NULL,
  `categorias_id_categoria` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ejercicios_categorias_categorias_id_categoria_foreign` (`categorias_id_categoria`),
  KEY `ejercicios_categorias_ejercicios_id_ejercicio_foreign` (`ejercicios_id_ejercicio`),
  CONSTRAINT `ejercicios_categorias_categorias_id_categoria_foreign` FOREIGN KEY (`categorias_id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE SET NULL,
  CONSTRAINT `ejercicios_categorias_ejercicios_id_ejercicio_foreign` FOREIGN KEY (`ejercicios_id_ejercicio`) REFERENCES `ejercicios` (`id_ejercicio`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=397 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.ejercicios_favoritos definition

CREATE TABLE `ejercicios_favoritos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` char(36) DEFAULT NULL,
  `id_ejercicio` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ejercicios_favoritos_id_usuario_foreign` (`id_usuario`),
  KEY `ejercicios_favoritos_id_ejercicio_foreign` (`id_ejercicio`),
  CONSTRAINT `ejercicios_favoritos_id_ejercicio_foreign` FOREIGN KEY (`id_ejercicio`) REFERENCES `ejercicios` (`id_ejercicio`) ON DELETE SET NULL,
  CONSTRAINT `ejercicios_favoritos_id_usuario_foreign` FOREIGN KEY (`id_usuario`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.planes_ejercicios definition

CREATE TABLE `planes_ejercicios` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sort` int DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `date_updated` timestamp NULL DEFAULT NULL,
  `plan` int unsigned DEFAULT NULL,
  `ejercicio` int unsigned DEFAULT NULL,
  `instrucciones_paciente` varchar(255) DEFAULT NULL,
  `notas_fisio` varchar(255) DEFAULT NULL,
  `series` int DEFAULT '1',
  `repeticiones` int DEFAULT '1',
  `duracion_seg` int DEFAULT NULL,
  `descanso_seg` int DEFAULT NULL,
  `veces_dia` int DEFAULT '1',
  `dias_semana` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `planes_ejercicios_ejercicio_foreign` (`ejercicio`),
  KEY `planes_ejercicios_sort_index` (`sort`),
  KEY `planes_ejercicios_plan_foreign` (`plan`),
  CONSTRAINT `planes_ejercicios_ejercicio_foreign` FOREIGN KEY (`ejercicio`) REFERENCES `ejercicios` (`id_ejercicio`) ON DELETE SET NULL,
  CONSTRAINT `planes_ejercicios_plan_foreign` FOREIGN KEY (`plan`) REFERENCES `Planes` (`id_plan`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.planes_registros definition

CREATE TABLE `planes_registros` (
  `id_registro` int unsigned NOT NULL AUTO_INCREMENT,
  `date_created` timestamp NULL DEFAULT NULL,
  `plan_item` int unsigned DEFAULT NULL,
  `paciente` char(36) DEFAULT NULL,
  `fecha_hora` datetime DEFAULT NULL,
  `completado` tinyint(1) DEFAULT '1',
  `repeticiones_realizadas` int NOT NULL,
  `duracion_real_seg` int DEFAULT NULL,
  `dolor_escala` int DEFAULT '0',
  `esfuerzo_escala` int DEFAULT '0',
  `nota_paciente` text,
  PRIMARY KEY (`id_registro`),
  KEY `planes_registros_plan_item_foreign` (`plan_item`),
  KEY `planes_registros_paciente_foreign` (`paciente`),
  CONSTRAINT `planes_registros_paciente_foreign` FOREIGN KEY (`paciente`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `planes_registros_plan_item_foreign` FOREIGN KEY (`plan_item`) REFERENCES `planes_ejercicios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.rutinas_ejercicios definition

CREATE TABLE `rutinas_ejercicios` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sort` int DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `date_updated` timestamp NULL DEFAULT NULL,
  `rutina` int unsigned DEFAULT NULL,
  `ejercicio` int unsigned DEFAULT NULL,
  `series` int DEFAULT '1',
  `repeticiones` int DEFAULT '1',
  `duracion_seg` int DEFAULT NULL,
  `descanso_seg` int DEFAULT NULL,
  `veces_dia` int DEFAULT '1',
  `dias_semana` json DEFAULT NULL,
  `instrucciones_paciente` text,
  `notas_fisio` text,
  PRIMARY KEY (`id`),
  KEY `rutinas_ejercicios_ejercicio_foreign` (`ejercicio`),
  KEY `rutinas_ejercicios_rutina_foreign` (`rutina`),
  CONSTRAINT `rutinas_ejercicios_ejercicio_foreign` FOREIGN KEY (`ejercicio`) REFERENCES `ejercicios` (`id_ejercicio`) ON DELETE SET NULL,
  CONSTRAINT `rutinas_ejercicios_rutina_foreign` FOREIGN KEY (`rutina`) REFERENCES `rutinas` (`id_rutina`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.clinicas definition

CREATE TABLE `clinicas` (
  `id_clinica` int unsigned NOT NULL AUTO_INCREMENT,
  `user_created` char(36) DEFAULT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  `user_updated` char(36) DEFAULT NULL,
  `date_updated` timestamp NULL DEFAULT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `postal` varchar(255) DEFAULT NULL,
  `nif` varchar(255) DEFAULT NULL,
  `logo` char(36) DEFAULT NULL,
  `color_primario` varchar(255) DEFAULT NULL,
  `color_secundario` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_clinica`),
  KEY `clinicas_user_updated_foreign` (`user_updated`),
  KEY `clinicas_user_created_foreign` (`user_created`),
  KEY `clinicas_logo_foreign` (`logo`),
  CONSTRAINT `clinicas_logo_foreign` FOREIGN KEY (`logo`) REFERENCES `directus_files` (`id`) ON DELETE SET NULL,
  CONSTRAINT `clinicas_user_created_foreign` FOREIGN KEY (`user_created`) REFERENCES `directus_users` (`id`),
  CONSTRAINT `clinicas_user_updated_foreign` FOREIGN KEY (`user_updated`) REFERENCES `directus_users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.clinicas_files definition

CREATE TABLE `clinicas_files` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinicas_id_clinica` int unsigned DEFAULT NULL,
  `directus_files_id` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clinicas_files_directus_files_id_foreign` (`directus_files_id`),
  KEY `clinicas_files_clinicas_id_clinica_foreign` (`clinicas_id_clinica`),
  CONSTRAINT `clinicas_files_clinicas_id_clinica_foreign` FOREIGN KEY (`clinicas_id_clinica`) REFERENCES `clinicas` (`id_clinica`) ON DELETE SET NULL,
  CONSTRAINT `clinicas_files_directus_files_id_foreign` FOREIGN KEY (`directus_files_id`) REFERENCES `directus_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.codigos_acceso definition

CREATE TABLE `codigos_acceso` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date_created` timestamp NULL DEFAULT NULL,
  `id_clinica` int unsigned DEFAULT NULL,
  `codigo` varchar(255) DEFAULT NULL,
  `tipo` varchar(255) DEFAULT NULL,
  `usos_maximos` int DEFAULT '1',
  `usos_actuales` int DEFAULT '0',
  `fecha_expiracion` datetime DEFAULT NULL,
  `creado_por` char(36) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigos_acceso_codigo_unique` (`codigo`),
  KEY `codigos_acceso_id_clinica_foreign` (`id_clinica`),
  KEY `codigos_acceso_creado_por_foreign` (`creado_por`),
  CONSTRAINT `codigos_acceso_creado_por_foreign` FOREIGN KEY (`creado_por`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `codigos_acceso_id_clinica_foreign` FOREIGN KEY (`id_clinica`) REFERENCES `clinicas` (`id_clinica`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.directus_sessions definition

CREATE TABLE `directus_sessions` (
  `token` varchar(64) NOT NULL,
  `user` char(36) DEFAULT NULL,
  `expires` timestamp NOT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `user_agent` text,
  `share` char(36) DEFAULT NULL,
  `origin` varchar(255) DEFAULT NULL,
  `next_token` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`token`),
  KEY `directus_sessions_user_foreign` (`user`),
  KEY `directus_sessions_share_foreign` (`share`),
  CONSTRAINT `directus_sessions_share_foreign` FOREIGN KEY (`share`) REFERENCES `directus_shares` (`id`) ON DELETE CASCADE,
  CONSTRAINT `directus_sessions_user_foreign` FOREIGN KEY (`user`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- kengoDB.usuarios_clinicas definition

CREATE TABLE `usuarios_clinicas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` char(36) DEFAULT NULL,
  `id_clinica` int unsigned DEFAULT NULL,
  `id_puesto` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `usuarios_clinicas_id_usuario_foreign` (`id_usuario`),
  KEY `usuarios_clinicas_id_clinica_foreign` (`id_clinica`),
  KEY `usuarios_clinicas_id_puesto_foreign` (`id_puesto`),
  CONSTRAINT `usuarios_clinicas_id_clinica_foreign` FOREIGN KEY (`id_clinica`) REFERENCES `clinicas` (`id_clinica`) ON DELETE SET NULL,
  CONSTRAINT `usuarios_clinicas_id_puesto_foreign` FOREIGN KEY (`id_puesto`) REFERENCES `Puestos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `usuarios_clinicas_id_usuario_foreign` FOREIGN KEY (`id_usuario`) REFERENCES `directus_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
