<?php
if (!defined('ABSPATH')) {
    exit;
}

function academy_cafe_theme_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');

    register_nav_menus(array(
        'primary' => __('Primary Menu', 'academy-cafe'),
    ));
}
add_action('after_setup_theme', 'academy_cafe_theme_setup');

function academy_cafe_assets() {
    wp_enqueue_style(
        'academy-cafe-main',
        get_template_directory_uri() . '/assets/css/main.css',
        array(),
        '1.0.0'
    );

    wp_enqueue_script(
        'academy-cafe-main',
        get_template_directory_uri() . '/assets/js/main.js',
        array(),
        '1.0.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'academy_cafe_assets');

function academy_cafe_fallback_menu() {
    echo '<ul class="nav-list">';
    echo '<li><a href="#about">학원 소개</a></li>';
    echo '<li><a href="#programs">프로그램</a></li>';
    echo '<li><a href="#cafe">스터디카페</a></li>';
    echo '<li><a href="#reviews">후기</a></li>';
    echo '<li><a href="#contact">상담 문의</a></li>';
    echo '</ul>';
}
