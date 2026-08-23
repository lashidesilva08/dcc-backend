import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // 1. Ensure at least one demo seller exists
  let sellers = await prisma.seller.findMany();
  if (sellers.length === 0) {
    console.log('No sellers found — creating a demo seller...');
    const bcrypt = await import('bcrypt');
    const hashedPw = await bcrypt.default.hash('demo1234', 10);
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo.seller@dcc.lk' },
      update: {},
      create: {
        name: 'Demo Seller',
        email: 'demo.seller@dcc.lk',
        password: hashedPw,
        role: 'SELLER',
        phone: '+94771234567',
        verified: true,
      },
    });
    await prisma.seller.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id,
        shopName: 'Digital City Store',
        shopUrl: 'digital-city-store',
        businessType: 'General',
        status: 'active',
        commissionRate: 10,
      },
    });
    sellers = await prisma.seller.findMany();
    console.log('Demo seller created.');
  }

  // 2. Fetch categories and build a slug → id map
  const categories = await prisma.category.findMany({ where: { status: 'active' } });
  const catMap = {};
  for (const c of categories) {
    // backend uses nameToSlug(name) — replicate that here
    const slug = c.name.toLowerCase()
      .replace(/[&]/g, 'and')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    catMap[slug] = c.id;
  }
  console.log('Category map:', catMap);

  const defaultSeller = sellers[0];

  const listings = [
    // Electronics
    { slug: 'electronics', title: 'WH-1000XM5 Wireless Headphones', desc: 'SONY - Industry leading noise canceling wireless headphones.', price: 97750, img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500' },
    { slug: 'electronics', title: 'AirPods Pro (2nd Generation)', desc: 'APPLE - Active Noise Cancellation, Adaptive Audio.', price: 64990, img: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=500' },
    { slug: 'electronics', title: 'Galaxy S24 Ultra 256GB', desc: 'SAMSUNG - Titanium built, Galaxy AI integrated smartphone.', price: 289990, img: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500' },
    { slug: 'electronics', title: 'MacBook Air 13 M3 Chip', desc: 'APPLE - Supercharged by M3, incredibly thin laptop.', price: 324990, img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500' },
    { slug: 'electronics', title: 'MX Master 3S Wireless Mouse', desc: 'LOGITECH - Ergonomic performance mouse.', price: 28500, img: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500' },
    { slug: 'electronics', title: 'JBL Flip 6 Portable Bluetooth Speaker', desc: 'JBL - Portable waterproof speaker with PartyBoost.', price: 34990, img: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500' },
    { slug: 'electronics', title: 'Canon EOS R50 Mirrorless Camera Kit', desc: 'CANON - Compact mirrorless camera with 18-45mm lens kit.', price: 198990, img: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { slug: 'electronics', title: 'Ultra-Smart Watch Pro Series 10', desc: 'APPLE - Advanced fitness tracking and smart notifications.', price: 45990, img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500' },

    // Fashion
    { slug: 'fashion', title: "Men's Linen Blend Shirt", desc: "H&M - Lightweight linen blend casual shirt.", price: 4990, img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500' },
    { slug: 'fashion', title: 'Classic Denim Jacket', desc: "LEVI'S - Timeless denim jacket with button closures.", price: 12990, img: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500' },
    { slug: 'fashion', title: 'Handloom Cotton Saree', desc: 'NANDI - Beautifully crafted handloom cotton saree.', price: 18500, img: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500' },
    { slug: 'fashion', title: 'Air Max Running Sneakers', desc: 'NIKE - Comfortable performance running sneakers.', price: 24990, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500' },
    { slug: 'fashion', title: 'Structured Tote Handbag', desc: 'CHARLES & KEITH - Chic structured handbag for everyday use.', price: 15990, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500' },
    { slug: 'fashion', title: 'Kids Cotton Co-ord Set', desc: 'MINI MODE - Soft breathable cotton co-ord set for kids.', price: 3990, img: 'https://images.unsplash.com/photo-1622290319146-7b63df48a635?w=500' },

    // Groceries
    { slug: 'groceries', title: 'Premium Nadu Rice 5kg', desc: 'ARALYA - High quality local premium Nadu rice.', price: 2450, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500' },
    { slug: 'groceries', title: 'Virgin Coconut Oil 1L', desc: 'MARVELLA - 100% natural virgin coconut oil.', price: 1890, img: 'https://images.unsplash.com/photo-1621447509323-570f171b8f61?w=500' },
    { slug: 'groceries', title: 'Premium Ceylon Tea 100 Bags', desc: 'DILMAH - Finest pure Ceylon black tea.', price: 1290, img: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500' },
    { slug: 'groceries', title: 'Full Cream Milk Powder 400g', desc: 'ANCHOR - Nourishing full cream milk powder.', price: 1650, img: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?w=500' },
    { slug: 'groceries', title: 'Assorted Biscuit Family Pack', desc: 'MALIBAN - Assorted biscuits in a family value pack.', price: 990, img: 'https://images.unsplash.com/photo-1558961312-503a6f08dd64?w=500' },
    { slug: 'groceries', title: 'Curry Powder Variety Pack', desc: 'MD - Authentic Sri Lankan curry powder variety pack.', price: 750, img: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=500' },

    // Home
    { slug: 'home', title: 'Cotton Bedsheet Set Queen', desc: 'DREAM HOME - Pure cotton comfortable bedsheet with 2 pillowcases.', price: 6990, img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500' },
    { slug: 'home', title: 'Non-Stick Cookware Set 5pc', desc: 'PRESTIGE - Heavy duty non-stick cooking pots.', price: 12490, img: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500' },
    { slug: 'home', title: 'LED Desk Lamp with USB Port', desc: 'PHILIPS - Smart LED desk lamp with USB charging port.', price: 5490, img: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500' },
    { slug: 'home', title: 'Blackout Curtain Pair', desc: 'STYLE LIVING - Premium blackout curtain pair.', price: 8990, img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500' },
    { slug: 'home', title: 'Stackable Storage Boxes Set of 3', desc: 'IKEA LK - Modular stackable storage solution.', price: 4590, img: 'https://images.unsplash.com/photo-1594411987595-46c59c55b550?w=500' },
    { slug: 'home', title: 'Compact Vacuum Cleaner', desc: 'BLACK+DECKER - Lightweight compact vacuum cleaner.', price: 18990, img: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500' },

    // Beauty
    { slug: 'beauty', title: 'Hyaluronic Acid Serum 30ml', desc: 'THE ORDINARY - Hydration support formula with vegan HA.', price: 4200, img: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?w=500' },
    { slug: 'beauty', title: 'Matte Lipstick Ruby Woo', desc: 'MAC - Iconic retro matte lipstick in bold red.', price: 6500, img: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500' },
    { slug: 'beauty', title: 'SPF 50 Ultra Sheer Sunscreen 88ml', desc: 'NEUTROGENA - Lightweight broad spectrum sunscreen.', price: 3800, img: 'https://images.unsplash.com/photo-1556229010-aa3f7ff66b24?w=500' },
    { slug: 'beauty', title: 'Bright Crystal EDT 90ml', desc: 'VERSACE - Feminine and luminous eau de toilette.', price: 18500, img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500' },
    { slug: 'beauty', title: 'Total Repair Shampoo 400ml', desc: 'LOREAL - Strengthening shampoo for damaged hair.', price: 1890, img: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500' },
    { slug: 'beauty', title: 'Hydrating Sheet Mask Pack of 5', desc: 'GARNIER - Hydrating and brightening sheet masks.', price: 1290, img: 'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=500' },

    // Sports
    { slug: 'sports', title: 'Non-Slip Yoga Mat 6mm', desc: 'DECATHLON - Perfect cushioning and grip yoga mat.', price: 4990, img: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500' },
    { slug: 'sports', title: 'Adjustable Dumbbell Pair 20kg', desc: 'PRO FITNESS - Versatile adjustable weights for home gym.', price: 24990, img: 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=500' },
    { slug: 'sports', title: 'English Willow Cricket Bat', desc: 'SS - Professional English willow cricket bat.', price: 15990, img: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500' },
    { slug: 'sports', title: 'Strike Football Size 5', desc: 'NIKE - FIFA quality mark match football.', price: 5990, img: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500' },
    { slug: 'sports', title: 'Training Gym Bag 50L', desc: 'ADIDAS - Durable gym bag with multiple compartments.', price: 8990, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500' },
    { slug: 'sports', title: 'Insulated Sports Water Bottle 750ml', desc: 'WILSON - Keeps drinks cold for 24 hours.', price: 2499, img: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500' },

    // Kids
    { slug: 'kids', title: 'Creative Building Blocks Set 450pc', desc: 'LEGO - 450-piece creative building toy set for kids.', price: 8990, img: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500' },
    { slug: 'kids', title: 'Plush Teddy Bear Large', desc: 'SOFT TOYS - Ultra soft and cuddly plush teddy bear.', price: 3490, img: 'https://images.unsplash.com/photo-1559251606-c623743a6d76?w=500' },
    { slug: 'kids', title: 'Kids 3-Wheel Scooter', desc: 'MICRO - Foldable 3-wheel scooter for ages 3-8.', price: 12990, img: 'https://images.unsplash.com/photo-1597200381847-30ec200eeb9a?w=500' },
    { slug: 'kids', title: 'Story Book Bundle 5 Books', desc: 'SCHOLASTIC - Five classic illustrated story books.', price: 2990, img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500' },
    { slug: 'kids', title: 'Ultimate Art and Craft Kit', desc: 'CRAYOLA - Complete art kit with crayons, paint, and more.', price: 5490, img: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500' },
    { slug: 'kids', title: 'World Map Jigsaw Puzzle 100pc', desc: 'RAVENSBURGER - Educational world map jigsaw puzzle.', price: 3990, img: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500' },
  ];

  let created = 0;
  let skipped = 0;

  for (const item of listings) {
  const catId = catMap[item.slug]

  if (!catId) {
    console.warn(
      `Category not found for slug: ${item.slug}`
    )
    continue
  }

  // Find existing listing
  let listing = await prisma.listing.findFirst({
    where: {
      title: item.title,
    },
  })

  // ==========================================================
  // CREATE LISTING IF IT DOES NOT EXIST
  // ==========================================================
  if (!listing) {
    listing = await prisma.listing.create({
      data: {
        sellerId: defaultSeller.id,
        categoryId: catId,
        title: item.title,
        description: item.desc,
        status: 'active',
      },
    })

    created++
  } else {
    skipped++

    // Make sure existing listing points to correct category.
    if (
      listing.categoryId !== catId ||
      listing.status !== 'active'
    ) {
      listing = await prisma.listing.update({
        where: {
          id: listing.id,
        },
        data: {
          categoryId: catId,
          status: 'active',
          description: item.desc,
        },
      })
    }
  }

  // ==========================================================
  // CHECK VARIANT
  // ==========================================================
  let variant = await prisma.productVariant.findFirst({
    where: {
      listingId: listing.id,
    },
  })

  const cleanSku =
    item.title
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12) +
    `-${listing.id}`

  // ==========================================================
  // CREATE VARIANT
  // ==========================================================
  if (!variant) {
    variant = await prisma.productVariant.create({
      data: {
        listingId: listing.id,
        sku: cleanSku,
        price: Number(item.price),
        stock: 20,
        status: 'active',
        attributes: {},
      },
    })
  } else {
    // Repair old variants
    variant = await prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        price: Number(item.price),
        status: 'active',
        stock:
          Number(variant.stock) > 0
            ? variant.stock
            : 20,
      },
    })
  }

  // ==========================================================
  // CHECK IMAGE
  // ==========================================================
  const existingImage =
    await prisma.productImage.findFirst({
      where: {
        variantId: variant.id,
      },
    })

  if (!existingImage && item.img) {
    await prisma.productImage.create({
      data: {
        variantId: variant.id,
        url: item.img,
        isMain: true,
      },
    })
  }
}

  console.log(`\n✅ Done! Created: ${created}, Skipped (already exist): ${skipped}`);

} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
