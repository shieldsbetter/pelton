import fakeExecutorBuilder from '../utils/fake-executor.mjs';
import test from 'ava';

test('cd', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {});

	const result = (await executor({})
			.eval('pwd').andThen()
			.cd('a').andThen()
			.eval('pwd').andThen()
			.cd('../b').andThen()
			.eval('pwd').andThen()
			.cd('c').andThen()
			.eval('pwd').andThen()
			.cd('/d').andThen()
			.eval('pwd')
			.run()).stdout;

	t.is(result, ['/', '/a', '/b', '/b/c', '/d'].join('\n') + '\n');
});

test('echo', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {});

	const result = (await executor({ X: 'EKS' })
			.echo('foo', 'X=$X')
			.run()).stdout;

	t.is(result, 'foo X=$X\n');
});

test('echo piped to kubectl', async t => {
	const executor = fakeExecutorBuilder((...args) => {
		t.deepEqual(args, [
			'foo\n', ['bar']
		]);

		return 'echo kubectl called!';
	}, {}, {});

	const result = (await executor()
			.echo('foo')
			.pipe().kubectl('bar')
			.run()).stdout;

	t.is(result, 'kubectl called!\n');
});

test('eval cat', async t => {
	const executor = fakeExecutorBuilder(() => {}, {
		'/a': 'file a',
		'/d1/b': 'file b'
	}, {});

	const result = (await executor({})
			.eval('cat', 'a').andThen()
			.eval('cat', '/d1/b').andThen()
			.cd('d1').andThen()
			.eval('cat', 'b').andThen()
			.eval('cat', '/a')
			.run()).stdout;

	t.is(result, ['file a', 'file b', 'file b', 'file a'].join('\n') + '\n');
});

test('eval custom - exit 0', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {
		'custom': 'echo custom command!'
	});

	const result = (await executor({})
			.eval('custom')
			.run()).stdout;

	t.is(result, 'custom command!\n');
});

test('eval custom - exit 1', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {
		'custom': 'echo Out of cheese! && exit 1'
	});

	const error = await t.throwsAsync(executor({}).eval('custom').run());
	t.is(error.stdout, 'Out of cheese!\n');
});

test('eval echo', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {});

	const result = (await executor({ X: 'EKS' })
			.eval('echo', 'foo', 'X=$X')
			.run()).stdout;

	t.is(result, 'foo X=EKS\n');
});

test('eval pwd', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {});

	const result = (await executor({})
			.eval('pwd')
			.run()).stdout;

	t.is(result, '/\n');
});

test('kubectl - exit 0', async t => {
	const kubecalls = [];
	const executor = fakeExecutorBuilder((...args) => {
		kubecalls.push(args);
		return 'echo kubectl called!';
	}, {}, {});

	const result = (await executor({})
			.kubectl('foo', 'bar')
			.run()).stdout;

	t.deepEqual(kubecalls, [
		['', ['foo', 'bar']]
	]);

	t.is(result, 'kubectl called!\n');
});

test('kubectl - exit 1', async t => {
	const kubecalls = [];
	const executor = fakeExecutorBuilder((...args) => {
		kubecalls.push(args);
		return 'echo kubectl failed! && exit 1';
	}, {}, {});

	const error = await t.throwsAsync(executor({}).kubectl('foo', 'bar').run());
	t.is(error.stdout, 'kubectl failed!\n');

	t.deepEqual(kubecalls, [
		['', ['foo', 'bar']]
	]);
});

test('orElse - short cicuit', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {});

	const result = (await executor()
			.echo('1')
			.orElse().echo('2')
			.run()).stdout;

	t.is(result, '1\n');
});

test('orElse - no short cicuit', async t => {
	const executor = fakeExecutorBuilder(() => {}, {}, {
		'custom': 'exit 1'
	});

	const result = (await executor({})
			.eval('custom')
			.orElse().echo('else!')
			.run()).stdout;

	t.is(result, 'else!\n');
});