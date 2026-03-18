<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="site-header">
  <div class="container header-inner">
    <a class="site-brand" href="<?php echo esc_url(home_url('/')); ?>">
      <?php if (has_custom_logo()) : ?>
        <?php the_custom_logo(); ?>
      <?php else : ?>
        <span class="site-brand-title"><?php bloginfo('name'); ?></span>
      <?php endif; ?>
    </a>

    <nav class="site-nav" aria-label="Main Navigation">
      <?php
        wp_nav_menu(array(
          'theme_location' => 'primary',
          'container' => false,
          'fallback_cb' => 'academy_cafe_fallback_menu',
        ));
      ?>
    </nav>
    <a class="header-cta" href="#contact">상담 예약</a>
  </div>
</header>
<main>
