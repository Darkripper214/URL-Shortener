const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const yup = require('yup');
const monk = require('monk');
const { nanoid } = require('nanoid');
const hbs = require('express-handlebars');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Database
const db = monk(process.env.MONGO_URI);
const urls = db.get('urls');
urls.createIndex({ slug: 1 }, { unique: true });

const schema = yup.object().shape({
  slug: yup
    .string()
    .trim()
    .matches(/[\w\-]/i),
  url: yup.string().trim().url().required(),
});

const PORT = process.env.PORT || 3215;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
app.engine('hbs', hbs({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');

// Safety and Logging
app.use(helmet());
app.use(morgan('tiny'));
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('./public'));

app.get('/:id', async (req, res) => {
  // redirect to url
  const { id: slug } = req.params;
  try {
    const url = await urls.findOne({ slug });
    if (url) {
      res.redirect(url.url);
      return;
    }
    res.redirect(`/?error=${slug} not found`);
  } catch (error) {
    res.redirect('/?error=Link not found');
  }
});

app.post('/url', async (req, res, next) => {
  // create a short url
  let { slug, url } = req.body;
  try {
    if (!slug) {
      slug = nanoid(5);
    } /* else {
      const existing = await urls.findOne({ slug });
      if (existing) {
        throw new Error('Slug in use.');
      }
    } */

    await schema.validate({
      slug,
      url,
    });
    slug = slug.toLowerCase();
    const newUrl = {
      url,
      slug,
    };
    const created = await urls.insert(newUrl);
    res.render('created', { created, BASE_URL });
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => {
  res.render('landing');
});

app.use((error, req, res, next) => {
  if (error.status) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.render('error', {
    message: error.message,
  });
});

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
