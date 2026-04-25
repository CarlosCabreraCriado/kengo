-- Tabla cumplimiento_diario
-- Almacena snapshots diarios de cumplimiento por paciente y plan
-- Poblada por cron nocturno (00:10) y backfill manual

CREATE TABLE `cumplimiento_diario` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `paciente` char(36) NOT NULL,
  `plan` int unsigned NOT NULL,
  `ejercicios_esperados` int NOT NULL DEFAULT 0,
  `ejercicios_completados` int NOT NULL DEFAULT 0,
  `es_dia_descanso` tinyint(1) NOT NULL DEFAULT 0,
  `dolor_promedio` decimal(3,1) DEFAULT NULL,
  `date_created` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fecha_paciente_plan` (`fecha`, `paciente`, `plan`),
  KEY `idx_paciente_fecha` (`paciente`, `fecha`),
  CONSTRAINT `fk_cumplimiento_paciente` FOREIGN KEY (`paciente`) REFERENCES `directus_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cumplimiento_plan` FOREIGN KEY (`plan`) REFERENCES `Planes` (`id_plan`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
