import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database...');
  await prisma.transaction.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding default user and seller...');
  const hashedPassword = await bcrypt.hash('123', 10);

  const user = await prisma.user.create({
    data: {
      name: 'City Retailer',
      email: 'seller@cityretailer.lk',
      password: hashedPassword,
      role: 'SELLER',
      phone: '+94771234567',
      verified: true,
    },
  });

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      shopName: 'City Retailer',
      shopUrl: 'city-retailer',
      businessType: 'Retail',
      status: 'active',
      commissionRate: 10.0,
    },
  });

  console.log('Seeding categories...');
  // NOTE: Names chosen so that nameToSlug() produces slugs that match
  // the existing frontend routes: /category/electronics, /category/fashion, etc.
  const categoriesData = [
    { name: 'Electronics',   icon: 'Laptop',      slug: 'electronics' },
    { name: 'Fashion',       icon: 'Shirt',        slug: 'fashion' },
    { name: 'Groceries',     icon: 'ShoppingBag',  slug: 'groceries' },
    { name: 'Home',          icon: 'Home',         slug: 'home' },
    { name: 'Beauty',        icon: 'Sparkles',     slug: 'beauty' },
    { name: 'Sports',        icon: 'Activity',     slug: 'sports' },
    { name: 'Kids',          icon: 'Smile',        slug: 'kids' },
  ];

  const categoriesMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.create({
      data: { name: cat.name, icon: cat.icon, status: 'active' },
    });
    categoriesMap[cat.slug] = created.id;
  }

  console.log('Seeding listings...');

  const listings = [
    // Electronics
    { slug: 'electronics', title: 'WH-1000XM5 Wireless Headphones',    desc: 'SONY - Industry leading noise canceling wireless headphones.',  price: 97750  },
    { slug: 'electronics', title: 'AirPods Pro (2nd Generation)',        desc: 'APPLE - Active Noise Cancellation, Adaptive Audio.',            price: 64990  },
    { slug: 'electronics', title: 'Galaxy S24 Ultra 256GB',             desc: 'SAMSUNG - Titanium built, Galaxy AI integrated smartphone.',     price: 289990 },
    { slug: 'electronics', title: 'Ultra-Smart Watch Pro Series 10',    desc: 'APPLE - Advanced fitness tracking and smart notifications.',     price: 45990  },
    { slug: 'electronics', title: 'MacBook Air 13" M3 Chip',            desc: 'APPLE - Supercharged by M3, incredibly thin laptop.',           price: 324990 },
    { slug: 'electronics', title: 'MX Master 3S Wireless Mouse',        desc: 'LOGITECH - Ergonomic performance mouse.',                       price: 28500  },
    { slug: 'electronics', title: 'JBL Flip 6 Portable Bluetooth Speaker', desc: 'JBL - Portable waterproof speaker with PartyBoost.',        price: 34990  },
    { slug: 'electronics', title: 'Canon EOS R50 Mirrorless Camera Kit', desc: 'CANON - Compact mirrorless camera with 18-45mm lens kit.',     price: 198990 },
    // Fashion
    { slug: 'fashion',     title: "Men's Linen Blend Shirt",            desc: "H&M - Lightweight linen blend casual shirt.",                   price: 4990   },
    { slug: 'fashion',     title: 'Classic Denim Jacket',               desc: "LEVI'S - Timeless denim jacket with button closures.",          price: 12990  },
    { slug: 'fashion',     title: 'Handloom Cotton Saree',              desc: 'NANDI - Beautifully crafted handloom cotton saree.',            price: 18500  },
    { slug: 'fashion',     title: 'Air Max Running Sneakers',           desc: 'NIKE - Comfortable performance running sneakers.',              price: 24990  },
    { slug: 'fashion',     title: 'Structured Tote Handbag',            desc: 'CHARLES & KEITH - Chic structured handbag for everyday use.',  price: 15990  },
    { slug: 'fashion',     title: 'Kids Cotton Co-ord Set',             desc: 'MINI MODE - Soft breathable cotton co-ord set for kids.',      price: 3990   },
    // Groceries
    { slug: 'groceries',   title: 'Premium Nadu Rice 5kg',              desc: 'ARALYA - High quality local premium Nadu rice.',                price: 2450   },
    { slug: 'groceries',   title: 'Virgin Coconut Oil 1L',              desc: 'MARVELLA - 100% natural virgin coconut oil.',                  price: 1890   },
    { slug: 'groceries',   title: 'Premium Ceylon Tea 100 Bags',        desc: 'DILMAH - Finest pure Ceylon black tea.',                       price: 1290   },
    { slug: 'groceries',   title: 'Full Cream Milk Powder 400g',        desc: 'ANCHOR - Nourishing full cream milk powder.',                  price: 1650   },
    { slug: 'groceries',   title: 'Assorted Biscuit Family Pack',       desc: 'MALIBAN - Assorted biscuits in a family value pack.',          price: 990    },
    { slug: 'groceries',   title: 'Curry Powder Variety Pack',          desc: 'MD - Authentic Sri Lankan curry powder variety pack.',         price: 750    },
    // Home
    { slug: 'home',        title: 'Cotton Bedsheet Set (Queen)',        desc: 'DREAM HOME - Pure cotton comfortable bedsheet with 2 pillowcases.', price: 6990 },
    { slug: 'home',        title: 'Non-Stick Cookware Set 5pc',         desc: 'PRESTIGE - Heavy duty non-stick cooking pots.',                price: 12490  },
    { slug: 'home',        title: 'LED Desk Lamp with USB Port',        desc: 'PHILIPS - Smart LED desk lamp with USB charging port.',        price: 5490   },
    { slug: 'home',        title: 'Blackout Curtain Pair',              desc: 'STYLE LIVING - Premium blackout curtain pair.',                price: 8990   },
    { slug: 'home',        title: 'Stackable Storage Boxes (3)',        desc: 'IKEA LK - Modular stackable storage solution.',                price: 4590   },
    { slug: 'home',        title: 'Compact Vacuum Cleaner',             desc: 'BLACK+DECKER - Lightweight compact vacuum cleaner.',           price: 18990  },
    // Beauty
    { slug: 'beauty',      title: 'Hyaluronic Acid Serum 30ml',        desc: 'THE ORDINARY - Hydration support formula with vegan HA.',      price: 4200   },
    { slug: 'beauty',      title: 'Matte Lipstick – Ruby Woo',          desc: 'MAC - Iconic retro matte lipstick in bold red.',               price: 6500   },
    { slug: 'beauty',      title: 'SPF 50+ Ultra Sheer Sunscreen 88ml', desc: 'NEUTROGENA - Lightweight broad spectrum sunscreen.',           price: 3800   },
    { slug: 'beauty',      title: 'Bright Crystal EDT 90ml',            desc: 'VERSACE - Feminine and luminous eau de toilette.',             price: 18500  },
    { slug: 'beauty',      title: 'Total Repair Shampoo 400ml',         desc: 'LOREAL - Strengthening shampoo for damaged hair.',             price: 1890   },
    { slug: 'beauty',      title: 'Sheet Mask Pack of 5',               desc: 'GARNIER - Hydrating and brightening sheet masks.',             price: 1290   },
    // Sports
    { slug: 'sports',      title: 'Non-Slip Yoga Mat 6mm',              desc: 'DECATHLON - Perfect cushioning and grip yoga mat.',            price: 4990   },
    { slug: 'sports',      title: 'Adjustable Dumbbell Pair 20kg',      desc: 'PRO FITNESS - Versatile adjustable weights for home gym.',     price: 24990  },
    { slug: 'sports',      title: 'English Willow Cricket Bat',         desc: 'SS - Professional English willow cricket bat.',                price: 15990  },
    { slug: 'sports',      title: 'Strike Football Size 5',             desc: 'NIKE - FIFA quality mark match football.',                     price: 5990   },
    { slug: 'sports',      title: 'Training Gym Bag 50L',               desc: 'ADIDAS - Durable gym bag with multiple compartments.',         price: 8990   },
    { slug: 'sports',      title: 'Insulated Sports Water Bottle 750ml', desc: 'WILSON - Keeps drinks cold for 24 hours.',                   price: 2490   },
    // Kids
    { slug: 'kids',        title: 'Creative Building Blocks Set',       desc: 'LEGO - 450-piece creative building toy set for kids.',        price: 8990   },
    { slug: 'kids',        title: 'Plush Teddy Bear Large',             desc: 'SOFT TOYS - Ultra soft and cuddly plush teddy bear.',         price: 3490   },
    { slug: 'kids',        title: 'Kids 3-Wheel Scooter',               desc: 'MICRO - Foldable 3-wheel scooter for ages 3–8.',              price: 12990  },
    { slug: 'kids',        title: 'Story Book Bundle (5)',               desc: 'SCHOLASTIC - Five classic illustrated story books.',          price: 2990   },
    { slug: 'kids',        title: 'Ultimate Art & Craft Kit',            desc: 'CRAYOLA - Complete art kit with crayons, paint, and more.',   price: 5490   },
    { slug: 'kids',        title: 'World Map Jigsaw Puzzle 100pc',      desc: 'RAVENSBURGER - Educational world map jigsaw puzzle.',         price: 3990   },
  ];

  for (const item of listings) {
    await prisma.listing.create({
      data: {
        sellerId: seller.id,
        categoryId: categoriesMap[item.slug],
        title: item.title,
        description: item.desc,
        price: item.price,
        stock: 50,
        status: 'active',
      },
    });
  }

  console.log(`✅ Seeded ${categoriesData.length} categories and ${listings.length} listings.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
