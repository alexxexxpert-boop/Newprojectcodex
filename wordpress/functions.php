<?php
/**
 * Add to your active theme's functions.php (or a custom plugin).
 * Enables headless WordPress mode for Next.js frontend.
 */

defined('ABSPATH') || exit;

// ─── CORS ────────────────────────────────────────────────────────────────────

add_action('rest_api_init', function () {
    $allowed_origin = defined('NEXTJS_SITE_URL') ? NEXTJS_SITE_URL : 'https://example.com';

    header('Access-Control-Allow-Origin: ' . esc_url_raw($allowed_origin));
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('HTTP/1.1 204 No Content');
        exit;
    }
}, 15);

// ─── REST API: featured_image_url ─────────────────────────────────────────────

add_action('rest_api_init', function () {
    register_rest_field('post', 'featured_image_url', [
        'get_callback' => function (array $post): ?string {
            $url = get_the_post_thumbnail_url($post['id'], 'large');
            return $url ?: null;
        },
        'schema' => [
            'description' => 'Full URL of the featured image',
            'type'        => ['string', 'null'],
            'context'     => ['view', 'embed'],
        ],
    ]);
});

// ─── REST API: reading_time ───────────────────────────────────────────────────

add_action('rest_api_init', function () {
    register_rest_field('post', 'reading_time', [
        'get_callback' => function (array $post): int {
            $content    = get_post_field('post_content', $post['id']);
            $word_count = str_word_count(wp_strip_all_tags($content));
            return (int) ceil($word_count / 200); // 200 words/min
        },
        'schema' => [
            'description' => 'Estimated reading time in minutes',
            'type'        => 'integer',
            'context'     => ['view', 'embed'],
        ],
    ]);
});

// ─── REST API: yoast_head_json fallback ──────────────────────────────────────
// Yoast SEO provides this natively. If Yoast is NOT installed, expose basic
// meta via a fallback so Next.js generateMetadata() always has title/description.

add_action('rest_api_init', function () {
    // Only register fallback if Yoast isn't providing it
    if (class_exists('WPSEO_Frontend')) {
        return;
    }

    register_rest_field('post', 'yoast_head_json', [
        'get_callback' => function (array $post): array {
            $id          = $post['id'];
            $title       = get_the_title($id);
            $excerpt     = wp_strip_all_tags(get_the_excerpt($id));
            $image_url   = get_the_post_thumbnail_url($id, 'large');

            return [
                'title'          => $title . ' | ' . get_bloginfo('name'),
                'description'    => $excerpt ?: $title,
                'og_title'       => $title,
                'og_description' => $excerpt ?: $title,
                'og_image'       => $image_url ? [['url' => $image_url]] : [],
                'og_type'        => 'article',
            ];
        },
        'schema' => ['type' => 'object', 'context' => ['view']],
    ]);
});

// ─── Application Passwords: ensure enabled ───────────────────────────────────

add_filter('wp_is_application_passwords_available', '__return_true');
