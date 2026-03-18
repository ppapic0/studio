<?php get_header(); ?>
<section class="section">
  <div class="container">
    <?php if (have_posts()) : ?>
      <?php while (have_posts()) : the_post(); ?>
        <article <?php post_class(); ?>>
          <h1><?php the_title(); ?></h1>
          <div><?php the_content(); ?></div>
        </article>
      <?php endwhile; ?>
    <?php else : ?>
      <p>콘텐츠가 없습니다.</p>
    <?php endif; ?>
  </div>
</section>
<?php get_footer(); ?>
