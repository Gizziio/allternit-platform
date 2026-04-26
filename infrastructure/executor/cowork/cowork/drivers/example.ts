/**
 * Apple Virtualization Driver Example
 * 
 * Demonstrates complete VM lifecycle management using the AppleVFDriver.
 * 
 * Usage:
 *   Allternit_MOCK_VIRTUALIZATION=1 npx ts-node example.ts
 */

import {
  AppleVFDriver,
  VMConfig,
  VMStatus,
  createAppleVFDriver,
} from './apple-vf';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Apple Virtualization.framework Driver Example            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check platform
  if (process.platform !== 'darwin') {
    console.error('❌ This example requires macOS');
    console.log('   Set Allternit_MOCK_VIRTUALIZATION=1 to run in mock mode');
    process.exit(1);
  }

  // Create driver instance
  console.log('📦 Creating AppleVFDriver instance...');
  const driver = createAppleVFDriver();
  console.log('   ✅ Driver created\n');

  // Check platform capabilities
  console.log('🔍 Checking platform capabilities...');
  const caps = driver.getPlatformCapabilities();
  console.log(`   macOS Version: ${caps.macosVersion}`);
  console.log(`   Virtualization Available: ${caps.virtualizationAvailable}`);
  console.log(`   Virtualization Version: ${caps.virtualizationVersion || 'N/A'}`);
  console.log(`   Apple Silicon: ${caps.isAppleSilicon}`);
  console.log(`   Rosetta 2 Available: ${caps.rosettaAvailable}`);
  console.log(`   Max CPUs: ${caps.maxCPUs}`);
  console.log(`   Max Memory: ${Math.round(caps.maxMemory / 1024 / 1024 / 1024)} GB`);
  console.log(`   Nested Virtualization: ${caps.supportsNestedVirtualization}\n`);

  // Validate platform
  console.log('✅ Validating platform compatibility...');
  const validation = await driver.validatePlatform();
  if (!validation.compatible) {
    console.error('❌ Platform validation failed:');
    validation.issues.forEach(issue => console.error(`   - ${issue}`));
    process.exit(1);
  }
  console.log('   ✅ Platform is compatible\n');

  // Setup event listeners
  console.log('📡 Setting up event listeners...');
  driver.on('vm:created', ({ vmId, name }) => {
    console.log(`   📥 VM created: ${name} (${vmId})`);
  });

  driver.on('vm:configured', ({ vmId }) => {
    console.log(`   ⚙️  VM configured: ${vmId}`);
  });

  driver.on('vm:starting', ({ vmId }) => {
    console.log(`   🚀 VM starting: ${vmId}`);
  });

  driver.on('vm:started', ({ vmId }) => {
    console.log(`   ✅ VM started: ${vmId}`);
  });

  driver.on('vm:guestAgentConnected', ({ vmId, port }) => {
    console.log(`   🔌 Guest agent connected: ${vmId} on port ${port}`);
  });

  driver.on('vm:stopping', ({ vmId }) => {
    console.log(`   🛑 VM stopping: ${vmId}`);
  });

  driver.on('vm:stopped', ({ vmId }) => {
    console.log(`   ⏹️  VM stopped: ${vmId}`);
  });

  driver.on('vm:error', ({ vmId, error }) => {
    console.error(`   ❌ VM error (${vmId}):`, error);
  });

  // Create VM configuration
  console.log('\n🔧 Creating VM configuration...');
  const vmConfig: VMConfig = {
    id: 'example-vm-001',
    name: 'Example Ubuntu VM',
    kernelPath: '~/.allternit/images/vmlinux-6.5.0-allternit-arm64',
    initrdPath: '~/.allternit/images/initrd.img-6.5.0-allternit-arm64',
    rootfsPath: '~/.allternit/images/ubuntu-22.04.ext4',
    cpuCount: 2,
    memorySize: 2 * 1024 * 1024 * 1024, // 2GB
    sharedDirectories: [
      {
        hostPath: '~/projects',
        vmPath: '/mnt/host-projects',
        readOnly: false,
      },
      {
        hostPath: '~/data',
        vmPath: '/mnt/host-data',
        readOnly: true,
      },
    ],
    guestAgentPort: 1024,
    bootArgs: 'console=hvc0 root=/dev/vda1 rw',
  };
  console.log(`   VM ID: ${vmConfig.id}`);
  console.log(`   VM Name: ${vmConfig.name}`);
  console.log(`   CPU Count: ${vmConfig.cpuCount}`);
  console.log(`   Memory: ${Math.round(vmConfig.memorySize / 1024 / 1024)} MB`);
  console.log(`   Shared Directories: ${vmConfig.sharedDirectories?.length || 0}\n`);

  // Create VM
  console.log('🆕 Creating VM...');
  let vm;
  try {
    vm = await driver.createVM(vmConfig);
    console.log(`   ✅ VM created with status: ${vm.status}\n`);
  } catch (error) {
    console.error('   ⚠️  Note: In real usage, kernel/initrd/rootfs files must exist');
    console.log('   🧪 Running in mock mode...\n');
    
    // Use mock mode for demo
    process.env.Allternit_MOCK_VIRTUALIZATION = '1';
    vm = await driver.createVM(vmConfig);
  }

  // Start VM
  console.log('▶️  Starting VM...');
  await driver.startVM(vm);
  console.log(`   Current status: ${driver.getVMStatus(vm)}\n`);

  // Wait a moment for guest agent
  console.log('⏳ Waiting for guest agent...');
  await delay(1000);
  console.log('   ✅ Guest agent should be connected\n');

  // Execute commands
  console.log('💻 Executing commands in VM...');
  
  try {
    const unameResult = await driver.executeCommand(vm, 'uname -a');
    console.log('   Command: uname -a');
    console.log(`   Exit Code: ${unameResult.exitCode}`);
    console.log(`   Output: ${unameResult.stdout.trim()}`);
    console.log(`   Duration: ${unameResult.duration}ms\n`);

    const lsResult = await driver.executeCommand(vm, 'ls -la /', {
      timeout: 30000,
    });
    console.log('   Command: ls -la /');
    console.log(`   Exit Code: ${lsResult.exitCode}`);
    console.log(`   Output Lines: ${lsResult.stdout.split('\n').length}\n`);

    // Command with working directory
    const pwdResult = await driver.executeCommand(vm, 'pwd', {
      workingDir: '/tmp',
    });
    console.log('   Command: pwd (in /tmp)');
    console.log(`   Output: ${pwdResult.stdout.trim()}\n`);

    // Command with environment variables
    const envResult = await driver.executeCommand(vm, 'echo $CUSTOM_VAR', {
      env: { CUSTOM_VAR: 'Hello from Allternit!' },
    });
    console.log('   Command: echo $CUSTOM_VAR');
    console.log(`   Output: ${envResult.stdout.trim()}\n`);
  } catch (error) {
    console.error('   Command execution error:', error);
  }

  // Stream logs
  console.log('📋 Streaming VM console logs (first 5 lines)...');
  let lineCount = 0;
  try {
    for await (const line of driver.streamLogs(vm, false)) {
      if (lineCount < 5) {
        console.log(`   ${line}`);
      }
      lineCount++;
    }
    if (lineCount > 5) {
      console.log(`   ... and ${lineCount - 5} more lines\n`);
    } else {
      console.log();
    }
  } catch (error) {
    console.log('   (Logs not available in mock mode)\n');
  }

  // Get buffered logs
  const bufferedLogs = driver.getConsoleLogs(vm, 10);
  console.log(`📦 Buffered logs available: ${bufferedLogs.length} lines\n`);

  // Demonstrate pause/resume
  console.log('⏸️  Pausing VM...');
  await driver.pauseVM(vm);
  console.log(`   Status: ${driver.getVMStatus(vm)}`);
  
  await delay(500);
  
  console.log('▶️  Resuming VM...');
  await driver.resumeVM(vm);
  console.log(`   Status: ${driver.getVMStatus(vm)}\n`);

  // List all VMs
  console.log('📊 Listing all VMs...');
  const allVMs = driver.getVMs();
  console.log(`   Total VMs: ${allVMs.length}`);
  allVMs.forEach(v => {
    console.log(`   - ${v.config.name} (${v.config.id}): ${v.status}`);
  });
  console.log();

  // Get specific VM
  console.log('🔍 Getting VM by ID...');
  const retrievedVM = driver.getVM(vmConfig.id);
  console.log(`   Found: ${retrievedVM ? '✅' : '❌'}`);
  console.log(`   Name: ${retrievedVM?.config.name}\n`);

  // Stop VM
  console.log('🛑 Stopping VM...');
  await driver.stopVM(vm, 30000); // 30 second timeout
  console.log(`   Status: ${driver.getVMStatus(vm)}\n`);

  // Destroy VM
  console.log('💥 Destroying VM...');
  await driver.destroyVM(vm);
  console.log('   ✅ VM destroyed\n');

  // Cleanup
  console.log('🧹 Cleaning up...');
  await driver.cleanup();
  console.log('   ✅ Cleanup complete\n');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   Example Complete ✅                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

// Run example
main().catch(error => {
  console.error('❌ Example failed:', error);
  process.exit(1);
});
