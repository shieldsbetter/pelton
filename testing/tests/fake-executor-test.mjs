import assert from 'assert';
import fakeExecutorBuilder from '../utils/fake-executor.mjs';

const tests = [
	{
		name: 'cd',
		run: async () => {
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

			assert.equal(
					result,
					['/', '/a', '/b', '/b/c', '/d'].join('\n') + '\n');
		}
	},
	{
		name: 'echo',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {});

			const result = (await executor({ X: 'EKS' })
					.echo('foo', 'X=$X')
					.run()).stdout;

			assert.equal(result, 'foo X=$X\n');
		}
	},
	{
		name: 'echo piped to kubectl',
		run: async () => {
			const executor = fakeExecutorBuilder((...args) => {
				assert.deepEqual(args, [
					'foo\n', ['bar']
				]);

				return 'echo kubectl called!';
			}, {}, {});

			const result = (await executor()
					.echo('foo')
					.pipe().kubectl('bar')
					.run()).stdout;

			assert.equal(result, 'kubectl called!\n');
		}
	},
	{
		name: 'eval cat',
		run: async () => {
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

			assert.equal(
					result,
					['file a', 'file b', 'file b', 'file a'].join('\n') + '\n');
		}
	},
	{
		name: 'eval custom - exit 0',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {
				'custom': 'echo custom command!'
			});

			const result = (await executor({})
					.eval('custom')
					.run()).stdout;

			assert.equal(result, 'custom command!\n');
		}
	},
	{
		name: 'eval custom - exit 1',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {
				'custom': 'echo Out of cheese! && exit 1'
			});

			const error =
					await assertRejects(executor({}).eval('custom').run());

			assert.equal(error.stdout, 'Out of cheese!\n');
		}
	},
	{
		name: 'eval echo',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {});

			const result = (await executor({ X: 'EKS' })
					.eval('echo', 'foo', 'X=$X')
					.run()).stdout;

			assert.equal(result, 'foo X=EKS\n');
		}
	},
	{
		name: 'eval pwd',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {});

			const result = (await executor({})
					.eval('pwd')
					.run()).stdout;

			assert.equal(result, '/\n');
		}
	},
	{
		name: 'kubectl - exit 0',
		run: async () => {
			const kubecalls = [];
			const executor = fakeExecutorBuilder((...args) => {
				kubecalls.push(args);
				return 'echo kubectl called!';
			}, {}, {});

			const result = (await executor({})
					.kubectl('foo', 'bar')
					.run()).stdout;

			assert.deepEqual(kubecalls, [
				['', ['foo', 'bar']]
			]);

			assert.equal(result, 'kubectl called!\n');
		}
	},
	{
		name: 'kubectl - exit 1',
		run: async () => {
			const kubecalls = [];
			const executor = fakeExecutorBuilder((...args) => {
				kubecalls.push(args);
				return 'echo kubectl failed! && exit 1';
			}, {}, {});

			const error = await assertRejects(
					executor({}).kubectl('foo', 'bar').run());
			assert.equal(error.stdout, 'kubectl failed!\n');

			assert.deepEqual(kubecalls, [
				['', ['foo', 'bar']]
			]);
		}
	},
	{
		name: 'orElse - short circuit',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {});

			const result = (await executor()
					.echo('1')
					.orElse().echo('2')
					.run()).stdout;

			assert.equal(result, '1\n');
		}
	},
	{
		name: 'orElse - no short circuit',
		run: async () => {
			const executor = fakeExecutorBuilder(() => {}, {}, {
				'custom': 'exit 1'
			});

			const result = (await executor({})
					.eval('custom')
					.orElse().echo('else!')
					.run()).stdout;

			assert.equal(result, 'else!\n');
		}
	}
];

async function assertRejects(pr) {
	try {
		const result = await pr;
		throw new AssertionError('Resolved with: ' + util.inspect(result));
	}
	catch (e) {
		return e;
	}
}

export default tests;
