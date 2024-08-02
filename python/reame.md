## run tests
1. python3 -m venv .venv
2. source .venv/bin/activate
3. pip install -r test_requirements.txt
4. python3 -m coverage run -m pytest src/tests/
5. coverage html && open htmlcov/index.html

## build package
1. python3 -m pip install --upgrade build
2. python3 -m build
