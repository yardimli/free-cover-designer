-- Table for Covers
CREATE TABLE `covers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `image_path` VARCHAR(512) NOT NULL,
  `caption` TEXT NULL DEFAULT NULL,
  `keywords` JSON NULL DEFAULT NULL, -- Use JSON type if MySQL 5.7+
  `categories` JSON NULL DEFAULT NULL, -- Use JSON type if MySQL 5.7+
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_covers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for Overlays
CREATE TABLE `overlays` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `image_path` VARCHAR(512) NOT NULL,
  `keywords` JSON NULL DEFAULT NULL, -- Use JSON type if MySQL 5.7+
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_overlays_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for Templates
CREATE TABLE `templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `json_path` VARCHAR(512) NULL DEFAULT NULL, -- Store original path for reference if needed
  `json_content` JSON NOT NULL, -- Store the actual JSON data. Use LONGTEXT if JSON type not available/preferred.
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_templates_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for Elements
CREATE TABLE `elements` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `image_path` VARCHAR(512) NOT NULL,
  `keywords` JSON NULL DEFAULT NULL, -- Use JSON type if MySQL 5.7+
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_elements_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
