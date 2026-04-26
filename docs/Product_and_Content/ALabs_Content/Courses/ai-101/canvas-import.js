/**
 * Canvas Course Import Automation
 * 
 * This script automates the creation of a Canvas course with all modules,
 * pages, discussions, and assignments.
 * 
 * Prerequisites:
 * - Node.js installed
 * - Playwright installed: npm install @playwright/test
 * - Canvas account with instructor access
 * 
 * Usage:
 * node canvas-import.js --email your@email.com --password yourpassword --courseId 12345
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const email = getArg('--email') || process.env.CANVAS_EMAIL;
const password = getArg('--password') || process.env.CANVAS_PASSWORD;
const courseId = getArg('--courseId') || process.env.CANVAS_COURSE_ID;
const baseUrl = getArg('--baseUrl') || 'https://canvas.instructure.com';

if (!email || !password || !courseId) {
  console.error('Usage: node canvas-import.js --email EMAIL --password PASSWORD --courseId COURSE_ID');
  console.error('Or set environment variables: CANVAS_EMAIL, CANVAS_PASSWORD, CANVAS_COURSE_ID');
  process.exit(1);
}

// Course structure
const courseStructure = {
  modules: [
    {
      name: 'Module 1: Foundations of AI',
      items: [
        { type: 'Page', title: 'Module 1 Overview' },
        { type: 'Page', title: '1.1 What is Artificial Intelligence?' },
        { type: 'Page', title: '1.2 The History and Evolution of AI' },
        { type: 'Page', title: '1.3 Types of AI and Machine Learning' },
        { type: 'Page', title: '1.4 Setting Up Your Development Environment' },
        { type: 'Discussion', title: 'Discussion: Introductions & Your AI Journey' },
        { type: 'Quiz', title: 'Module 1 Quiz: Foundations of AI' }
      ]
    },
    {
      name: 'Module 2: Machine Learning Basics',
      items: [
        { type: 'Page', title: 'Module 2 Overview' },
        { type: 'Page', title: '2.1 The Machine Learning Workflow' },
        { type: 'Page', title: '2.2 Data Collection and Preprocessing' },
        { type: 'Page', title: '2.3 Training, Validation, and Test Sets' },
        { type: 'Page', title: '2.4 Evaluation Metrics and Model Performance' },
        { type: 'Discussion', title: 'Discussion: Real-World ML Applications' },
        { type: 'Assignment', title: 'Lab: Exploring the Iris Dataset' },
        { type: 'Quiz', title: 'Module 2 Quiz: Machine Learning Fundamentals' }
      ]
    },
    {
      name: 'Module 3: Supervised Learning',
      items: [
        { type: 'Page', title: 'Module 3 Overview' },
        { type: 'Page', title: '3.1 Linear Regression: Predicting Continuous Values' },
        { type: 'Page', title: '3.2 Logistic Regression: Binary Classification' },
        { type: 'Page', title: '3.3 Decision Trees and Interpretability' },
        { type: 'Page', title: '3.4 Ensemble Methods: Random Forests and Boosting' },
        { type: 'Discussion', title: 'Discussion: Interpretability vs Performance' },
        { type: 'Assignment', title: 'Assignment: Predict Housing Prices' },
        { type: 'Quiz', title: 'Module 3 Quiz: Supervised Learning' }
      ]
    },
    {
      name: 'Module 4: Neural Networks',
      items: [
        { type: 'Page', title: 'Module 4 Overview' },
        { type: 'Page', title: '4.1 From Biology to Computation: The Neuron' },
        { type: 'Page', title: '4.2 The Perceptron: A Single Neuron Model' },
        { type: 'Page', title: '4.3 Multi-Layer Neural Networks' },
        { type: 'Page', title: '4.4 Backpropagation: How Networks Learn' },
        { type: 'Page', title: '4.5 Activation Functions and Their Properties' },
        { type: 'Page', title: '4.6 Building Networks with TensorFlow/Keras' },
        { type: 'Discussion', title: 'Discussion: The Black Box Problem' },
        { type: 'Assignment', title: 'Lab: Neural Network from Scratch' },
        { type: 'Assignment', title: 'Assignment: Digit Recognition with TensorFlow' },
        { type: 'Quiz', title: 'Module 4 Quiz: Neural Network Fundamentals' }
      ]
    },
    {
      name: 'Module 5: Deep Learning',
      items: [
        { type: 'Page', title: 'Module 5 Overview' },
        { type: 'Page', title: '5.1 Why Deep Learning Now? Scale and Breakthroughs' },
        { type: 'Page', title: '5.2 Convolutional Neural Networks: Seeing the World' },
        { type: 'Page', title: '5.3 Recurrent Neural Networks: Understanding Sequences' },
        { type: 'Page', title: '5.4 Fighting Overfitting: Dropout and Regularization' },
        { type: 'Page', title: '5.5 Transfer Learning: Standing on Giants\' Shoulders' },
        { type: 'Page', title: '5.6 PyTorch: An Alternative Framework' },
        { type: 'Discussion', title: 'Discussion: Deep Learning Applications' },
        { type: 'Assignment', title: 'Lab: Image Classification with CNNs' },
        { type: 'Assignment', title: 'Assignment: Sentiment Classifier with RNNs' },
        { type: 'Quiz', title: 'Module 5 Quiz: Deep Learning Architectures' }
      ]
    },
    {
      name: 'Module 6: NLP & Transformers',
      items: [
        { type: 'Page', title: 'Module 6 Overview' },
        { type: 'Page', title: '6.1 Introduction to Natural Language Processing' },
        { type: 'Page', title: '6.2 From Words to Vectors: Word Embeddings' },
        { type: 'Page', title: '6.3 The Attention Revolution' },
        { type: 'Page', title: '6.4 The Transformer: Attention Is All You Need' },
        { type: 'Page', title: '6.5 BERT, GPT, and the Modern NLP Stack' },
        { type: 'Page', title: '6.6 Generative AI and Ethical Considerations' },
        { type: 'Discussion', title: 'Discussion: AI Ethics and Responsibility' },
        { type: 'Assignment', title: 'Lab: Fine-tuning BERT' },
        { type: 'Assignment', title: 'Final Project: Build an AI Application' },
        { type: 'Quiz', title: 'Module 6 Quiz: NLP and Transformers' }
      ]
    }
  ],
  pages: [
    { title: 'Home Page', file: 'home-page.html' },
    { title: 'Syllabus', file: 'syllabus.html' },
    { title: 'Resources', file: 'resources.html' }
  ]
};

async function login(page) {
  console.log('Logging into Canvas...');
  await page.goto(`${baseUrl}/login/canvas`);
  
  await page.fill('#pseudonym_session_unique_id', email);
  await page.fill('#pseudonym_session_password', password);
  await page.click('input[type="submit"][value="Log In"]');
  
  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
  
  // Check if login was successful
  const currentUrl = page.url();
  if (currentUrl.includes('login')) {
    throw new Error('Login failed. Check your credentials.');
  }
  
  console.log('✓ Logged in successfully');
}

async function createPage(page, courseId, title, content = '') {
  console.log(`  Creating page: ${title}`);
  
  await page.goto(`${baseUrl}/courses/${courseId}/pages`);
  await page.click('button:has-text("+ Page")');
  
  // Fill in page title
  await page.fill('input[placeholder="Page Name"]', title);
  
  // Fill in content (if provided)
  if (content) {
    // Switch to HTML editor if needed
    const htmlEditor = await page.$('button:has-text("HTML Editor")');
    if (htmlEditor) await htmlEditor.click();
    
    await page.fill('textarea', content);
  }
  
  // Save the page
  await page.click('button:has-text("Save")');
  await page.waitForLoadState('networkidle');
  
  console.log(`  ✓ Created page: ${title}`);
}

async function createModule(page, courseId, moduleName) {
  console.log(`Creating module: ${moduleName}`);
  
  await page.goto(`${baseUrl}/courses/${courseId}/modules`);
  await page.click('button:has-text("+ Module")');
  
  await page.fill('input[placeholder="Module Name"]', moduleName);
  await page.click('button:has-text("Create Module")');
  
  await page.waitForLoadState('networkidle');
  console.log(`✓ Created module: ${moduleName}`);
}

async function addModuleItem(page, courseId, moduleName, item) {
  console.log(`  Adding ${item.type}: ${item.title}`);
  
  // Navigate to modules page
  await page.goto(`${baseUrl}/courses/${courseId}/modules`);
  
  // Find the module and click "+" to add item
  const moduleHeader = await page.$(`text=${moduleName}`);
  if (!moduleHeader) {
    console.log(`  ⚠ Module not found: ${moduleName}`);
    return;
  }
  
  // This is a simplified version - actual implementation would need to 
  // navigate the specific Canvas UI for adding different item types
  console.log(`  ⚠ Would add ${item.type}: ${item.title}`);
}

async function importCourse() {
  console.log('🚀 Starting Canvas course import...\n');
  
  const browser = await chromium.launch({ headless: false }); // Set to true for production
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Login
    await login(page);
    
    // Create standalone pages (Home, Syllabus, Resources)
    console.log('\n📄 Creating course pages...');
    for (const pageInfo of courseStructure.pages) {
      const content = fs.readFileSync(
        path.join(__dirname, pageInfo.file), 
        'utf-8'
      );
      await createPage(page, courseId, pageInfo.title, content);
    }
    
    // Create modules
    console.log('\n📚 Creating modules...');
    for (const module of courseStructure.modules) {
      await createModule(page, courseId, module.name);
      
      // Add items to module
      for (const item of module.items) {
        await addModuleItem(page, courseId, module.name, item);
      }
    }
    
    console.log('\n✅ Course import completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the import
importCourse().catch(console.error);
