-- Table for Covers
CREATE TABLE `covers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cover_type_id` INT(11) NULL DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `image_path` VARCHAR(512) NOT NULL,
  `caption` TEXT NULL DEFAULT NULL,
  `keywords` JSON NULL DEFAULT NULL,
  `categories` JSON NULL DEFAULT NULL,
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
  `keywords` JSON NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_overlays_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for Templates
CREATE TABLE `templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cover_type_id` INT(11) NULL DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `keywords` JSON NULL DEFAULT NULL,
  `thumbnail_path` VARCHAR(512) NOT NULL,
  `json_path` VARCHAR(512) NULL DEFAULT NULL,
  `json_content` JSON NOT NULL,
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
  `keywords` JSON NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_elements_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cover_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type_name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_name_unique` (`type_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populate initial cover types
INSERT INTO `cover_types` (`type_name`) VALUES
('Book Cover'),
('Spine'),
('Back Cover'),
('Album Cover');
